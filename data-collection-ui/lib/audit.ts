import { createClient } from "@/utils/supabase/server";
import type { AuditLog } from "@/types/audit";

export async function logAdminAction(
  adminUserId: string,
  adminEmail: string,
  action: string,
  targetType: "user" | "session" | "system",
  details: Record<string, unknown>,
  targetId?: string,
  request?: Request
) {
  try {
    const supabase = await createClient();

    // Get IP address and user agent from request if available
    const ipAddress =
      request?.headers.get("x-forwarded-for") ||
      request?.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    const auditData = {
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    const { error } = await supabase.from("audit_logs").insert(auditData);

    if (error) {
      console.error("Failed to log admin action:", error);
      // Don't throw error to avoid disrupting the main operation
    }
  } catch (error) {
    console.error("Error logging admin action:", error);
    // Don't throw error to avoid disrupting the main operation
  }
}

export async function getAuditLogs(
  limit = 100,
  offset = 0,
  adminId?: string,
  action?: string,
  targetType?: "user" | "session" | "system"
): Promise<{ logs: AuditLog[]; total: number }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (adminId) {
      query = query.eq("admin_user_id", adminId);
    }

    if (action) {
      query = query.eq("action", action);
    }

    if (targetType) {
      query = query.eq("target_type", targetType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      logs: data || [],
      total: count || 0,
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return { logs: [], total: 0 };
  }
}
