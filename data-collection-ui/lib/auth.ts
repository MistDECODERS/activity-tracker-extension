import { createClient } from "@/utils/supabase/server";
import { UserProfiles } from "@/types/user";
import { redirect } from "next/navigation";

export async function getCurrentUser(): Promise<UserProfiles | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    return null;
  }

  return userProfile as UserProfiles;
}

export async function checkAdminRole(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

export async function requireAdmin(): Promise<{
  success: boolean;
  user?: UserProfiles;
  error?: string;
  status: number;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "User not authenticated",
      status: 401,
    };
  }

  if (user.role !== "admin") {
    return {
      success: false,
      error: "Admin access required",
      status: 403,
    };
  }

  return {
    success: true,
    user,
    status: 200,
  };
}

export const ensureAdmin = async (): Promise<void> => {
  // Ensure user is admin
  try {
    const adminResponse = await requireAdmin();
    if (adminResponse.status === 200) {
      // User is admin, proceed with fetching data
    } else if (adminResponse.status === 401 || adminResponse.status === 403) {
      console.log(adminResponse.error);
      redirect("/dashboard");
    }
  } catch (error) {
    redirect("/dashboard");
  }
};
