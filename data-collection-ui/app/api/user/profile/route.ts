import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const GET = async () => {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Get user profile from user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError.message);
      return NextResponse.json(
        { error: "Profile not found", message: profileError.message },
        { status: 404 }
      );
    }

    return NextResponse.json(userProfile, { status: 200 });
  } catch (err) {
    console.error("Unexpected error getting user profile:", err);
    return NextResponse.json(
      {
        error: "Server error",
        message: "Failed to get user profile",
      },
      { status: 500 }
    );
  }
};
