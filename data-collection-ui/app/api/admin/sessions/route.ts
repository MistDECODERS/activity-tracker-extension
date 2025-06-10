import { createClient } from "@/utils/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// GET: Get all recording sessions (admin only)
export async function GET() {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all user profiles with task_statuses (this contains all sessions)
    const { data: userProfiles } = await supabase
      .from("user_profiles")
      .select("id, email, fullName, task_statuses");

    // Get completed tasks from tasks table for created_at timestamps
    // The fileId field contains the task name (e.g., "ecom-1")
    const { data: completedTasks } = await supabase
      .from("tasks")
      .select("id, user_id, created_at, path");

    // Create lookup map for completed tasks using fileId (task name)
    const completedTasksMap = new Map();
    if (completedTasks) {
      for (const task of completedTasks) {
        // Extract task name from fileId (e.g., "ecom-1" from "ecom-1.json" or just "ecom-1")
        const taskName = task.path?.split("/").pop()?.replace(".json", "");
        if (taskName) {
          completedTasksMap.set(taskName + task.user_id, task);
        }
      }
    }

    // Process sessions from user_profiles task_statuses
    const sessions = [];

    for (const userProfile of userProfiles || []) {
      if (!userProfile.task_statuses) continue;

      // Each key in task_statuses is a taskId (e.g., "ecom-1"), value is the status
      for (const [taskId, status] of Object.entries(
        userProfile.task_statuses
      )) {
        // Check for recording file only for completed tasks
        let recordingFile = null;
        if (status === "completed") {
          try {
            const { data: files } = await supabase.storage
              .from("recordings")
              .list(userProfile.id, { limit: 100 });

            if (files) {
              // Look for file with taskId in name (e.g., "ecom-1.json")
              recordingFile = files.find((file) => file.name.includes(taskId));
            }
          } catch (error) {
            console.warn(`Storage access error for task ${taskId}:`, error);
          }
        }

        // Get start time - for completed tasks use tasks table, lookup by taskId (fileId)
        let startTime = null;
        const completedTask = completedTasksMap.get(taskId + userProfile.id);
        if (completedTask) {
          startTime = completedTask.created_at;
        }

        sessions.push({
          id: `session-${taskId}`,
          userId: userProfile.id,
          userEmail: userProfile.email,
          userName: userProfile.fullName,
          taskId,
          status,
          startTime,
          fileSize: recordingFile?.metadata?.size || null,
        });
      }
    }

    // Filter out sessions with null startTime (in-progress sessions) from sorting
    // Sort by most recent first, putting in-progress sessions at the end
    sessions.sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a recording session (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { sessionId, taskId, userId } = await request.json();

    if (!sessionId || !taskId || !userId) {
      return NextResponse.json(
        { error: "Session ID, Task ID, and User ID are required" },
        { status: 400 }
      );
    }

    // Delete recording file from storage if it exists
    try {
      const { data: files } = await supabase.storage
        .from("recordings")
        .list(userId);

      // Look for file with taskId in name (e.g., "ecom-1.json")
      const recordingFile = files?.find((file) => file.name.includes(taskId));
      if (recordingFile) {
        await supabase.storage
          .from("recordings")
          .remove([`${userId}/${recordingFile.name}`]);
      }
    } catch (storageError) {
      console.error("Error deleting recording file:", storageError);
    }

    // Remove task from user's task_statuses
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("task_statuses")
      .eq("id", userId)
      .single();

    if (userProfile?.task_statuses) {
      const updatedTaskStatuses = { ...userProfile.task_statuses };
      delete updatedTaskStatuses[taskId];

      await supabase
        .from("user_profiles")
        .update({ task_statuses: updatedTaskStatuses })
        .eq("id", userId);
    }

    // Delete from tasks table if it exists (for completed tasks)
    // Find task by fileId (which matches taskId) and user_id
    await supabase
      .from("tasks")
      .delete()
      .eq("fileId", `${taskId}.json`)
      .eq("user_id", userId);

    return NextResponse.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
