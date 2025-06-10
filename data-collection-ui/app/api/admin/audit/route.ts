import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAuditLogs } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") || "50");
    const offset = Number.parseInt(searchParams.get("offset") || "0");
    const adminId = searchParams.get("adminId") || undefined;
    const action = searchParams.get("action") || undefined;
    const targetType = searchParams.get("targetType") as
      | "user"
      | "session"
      | "system"
      | undefined;

    const { logs, total } = await getAuditLogs(
      limit,
      offset,
      adminId,
      action,
      targetType
    );

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
