import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

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
    const userId = searchParams.get("userId");
    const taskId = searchParams.get("taskId");

    if (!userId || !taskId) {
      return NextResponse.json(
        { error: "Missing userId or taskId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the recording file from storage
    const fileName = `${taskId}.json`;
    const filePath = `${userId}/${fileName}`;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("recordings")
      .download(filePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Recording file not found" },
        { status: 404 }
      );
    }

    // Convert blob to buffer
    const buffer = await fileData.arrayBuffer();

    // Return the file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading recording:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
