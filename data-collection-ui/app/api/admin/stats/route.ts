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

    // Parallel queries for better performance
    const [
      { count: totalUsers },
      { count: totalTasks },
      { data: fileSizes },
      { data: usersWithTasks },
      { data: recentUsers },
    ] = await Promise.all([
      // Total users
      supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true }),

      // Total tasks
      supabase.from("tasks").select("*", { count: "exact", head: true }),

      // File sizes (only non-null values)
      supabase.from("tasks").select("file_size").not("file_size", "is", null),

      // Users with task statuses (for active sessions)
      supabase
        .from("user_profiles")
        .select("task_statuses")
        .not("task_statuses", "is", null),

      // Recent users
      supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // Calculate storage usage efficiently
    let storageUsed = 0;
    if (fileSizes) {
      storageUsed = fileSizes.reduce(
        (total, task) => total + (task.file_size || 0),
        0
      );
    }

    // Convert bytes to MB
    const storageGB = (storageUsed / (1024 * 1024)).toFixed(2);

    // Count active sessions efficiently
    let activeSessions = 0;
    if (usersWithTasks) {
      activeSessions = usersWithTasks.reduce((total, user) => {
        if (user.task_statuses) {
          const inProgressCount = Object.values(user.task_statuses).filter(
            (status) => status === "in-progress"
          ).length;
          return total + inProgressCount;
        }
        return total;
      }, 0);
    }

    const stats = {
      totalUsers: totalUsers || 0,
      totalTasks: totalTasks || 0,
      storageUsed: `${storageGB} MB`,
      activeSessions,
      totalRecordings: totalTasks || 0,
      recentUsers: recentUsers || [],
      systemHealth: {
        database: true,
        storage: true,
      },
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
