import { createClient } from "@/utils/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import type { UserProfiles } from "@/types/user";

// GET: Get all users (admin only)
export async function GET() {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const supabase = await createClient();

    // Get all users
    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update user role (admin only)
export async function PUT(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const admin = authResult.user as UserProfiles;
    const supabase = await createClient();

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: "User ID and role are required" },
        { status: 400 }
      );
    }

    if (!["admin", "user"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

    // Get the current user data for audit logging
    const { data: targetUser } = await supabase
      .from("user_profiles")
      .select("email, role")
      .eq("id", userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldRole = targetUser.role;

    // Update user role
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ role })
      .eq("id", userId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the admin action
    await logAdminAction(
      admin.id,
      admin.email,
      "update_user_role",
      "user",
      {
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        oldRole,
        newRole: role,
      },
      userId,
      request
    );

    return NextResponse.json({
      message: "User role updated successfully",
      user: data[0],
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
