import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// This is a one-time setup endpoint to create the first admin user
// In production, this should be removed or heavily restricted
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if this is the first user (for security)
    const { count: userCount } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    // Only allow admin creation if there are fewer than 5 users (security measure)
    if (userCount && userCount > 5) {
      return NextResponse.json(
        { error: "Admin creation not allowed - too many existing users" },
        { status: 403 }
      );
    }

    // Update existing user to admin by email
    const { data: updatedUser, error: updateError } = await supabase
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("email", email)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update user: " + updateError.message },
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found with that email" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "User successfully updated to admin",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Check if any admin users exist
export async function GET() {
  try {
    const supabase = await createClient();

    const { count: adminCount } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    const { count: totalUsers } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      hasAdminUsers: (adminCount || 0) > 0,
      adminCount: adminCount || 0,
      totalUsers: totalUsers || 0,
      canCreateAdmin: (totalUsers || 0) <= 5,
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
