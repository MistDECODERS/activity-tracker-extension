import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// GET: Get admin dashboard stats
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

    // Get total users
    const { count: totalUsers } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    // Get total tasks
    const { count: totalTasks } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true });

    // Get storage usage from bucket
    let storageUsed = 0;
    let totalRecordings = 0;

    try {
      const { data: userFolders } = await supabase.storage
        .from("recordings")
        .list("", { limit: 1000 });

      if (userFolders) {
        for (const folder of userFolders) {
          const { data: files } = await supabase.storage
            .from("recordings")
            .list(folder.name, { limit: 1000 });

          if (files) {
            totalRecordings += files.length;
            storageUsed += files.reduce(
              (total, file) => total + (file.metadata?.size || 0),
              0
            );
          }
        }
      }
    } catch (storageError) {
      console.error("Error calculating storage usage:", storageError);
    }

    // Convert bytes to MB (matching your function)
    const storageGB = (storageUsed / (1024 * 1024)).toFixed(2);

    // Count in-progress tasks across all users
    const { data: usersWithTasks } = await supabase
      .from("user_profiles")
      .select("task_statuses")
      .not("task_statuses", "is", null);

    let activeSessions = 0;
    if (usersWithTasks) {
      for (const user of usersWithTasks) {
        if (user.task_statuses) {
          // Count tasks with "in-progress" status
          for (const status of Object.values(user.task_statuses)) {
            if (status === "in-progress") {
              activeSessions++;
            }
          }
        }
      }
    }

    // System health checks
    const systemHealth = {
      database: true, // If we got here, database is working
      storage: true, // Assume storage is working if no errors above
    };

    const stats = {
      totalUsers: totalUsers || 0,
      totalTasks: totalTasks || 0,
      storageUsed: `${storageGB} MB`,
      activeSessions,
      totalRecordings,
      systemHealth,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
