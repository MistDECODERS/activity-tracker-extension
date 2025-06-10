export interface AuditLog {
  id: string;
  created_at: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  target_type: "user" | "session" | "system";
  target_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}
