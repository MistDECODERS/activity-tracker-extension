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

    // Parallel queries for better performance
    const [{ data: userProfiles }, { data: completedTasks }] =
      await Promise.all([
        // Get all user profiles with task_statuses
        supabase
          .from("user_profiles")
          .select("id, email, fullName, task_statuses"),

        // Get completed tasks with file_size (no need for storage calls)
        supabase
          .from("tasks")
          .select("id, user_id, created_at, path, file_size"),
      ]);

    // Create lookup map for completed tasks using task name + user_id
    const completedTasksMap = new Map();
    if (completedTasks) {
      for (const task of completedTasks) {
        // Extract task name from path (e.g., "ecom-1" from "user-id/ecom-1.json")
        const taskName = task.path?.split("/").pop()?.replace(".json", "");
        if (taskName) {
          // Use taskName + user_id as key for unique identification
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
        // Get start time and file size from tasks table (for completed tasks)
        let startTime = null;
        let fileSize = null;

        const completedTask = completedTasksMap.get(taskId + userProfile.id);
        if (completedTask) {
          startTime = completedTask.created_at;
          fileSize = completedTask.file_size; // Use file_size from tasks table
        }

        sessions.push({
          id: `session-${taskId}-${userProfile.id}`, // More unique ID
          userId: userProfile.id,
          userEmail: userProfile.email,
          userName: userProfile.fullName,
          taskId,
          status,
          startTime,
          fileSize, // Now from database instead of storage metadata
        });
      }
    }

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

    // Parallel operations for better performance
    const [{ data: userProfile }, { data: taskToDelete }] = await Promise.all([
      // Get user profile for task_statuses update
      supabase
        .from("user_profiles")
        .select("task_statuses")
        .eq("id", userId)
        .single(),

      // Get task info to find the file path for storage deletion
      supabase
        .from("tasks")
        .select("path")
        .like("path", `%/${taskId}.json`)
        .eq("user_id", userId)
        .single(),
    ]);

    // Parallel cleanup operations
    const cleanupPromises = [];

    // 1. Remove task from user's task_statuses
    if (userProfile?.task_statuses) {
      const updatedTaskStatuses = { ...userProfile.task_statuses };
      delete updatedTaskStatuses[taskId];

      cleanupPromises.push(
        supabase
          .from("user_profiles")
          .update({ task_statuses: updatedTaskStatuses })
          .eq("id", userId)
      );
    }

    // 2. Delete from tasks table
    cleanupPromises.push(
      supabase
        .from("tasks")
        .delete()
        .like("path", `%/${taskId}.json`)
        .eq("user_id", userId)
    );

    // 3. Delete recording file from storage (if exists)
    if (taskToDelete?.path) {
      cleanupPromises.push(
        supabase.storage.from("recordings").remove([taskToDelete.path])
      );
    }

    // Execute all cleanup operations in parallel
    const results = await Promise.allSettled(cleanupPromises);

    // Log any errors but don't fail the request
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Cleanup operation ${index} failed:`, result.reason);
      }
    });

    return NextResponse.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
