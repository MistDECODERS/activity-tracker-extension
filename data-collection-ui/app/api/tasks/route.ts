import { uploadFileToBucket, removeFilesFromBucket } from "@/actions/bucket";
import {
  insertUploadDataToTaskTable,
  removeUploadDataFromTaskTable,
} from "@/actions/tasks";
import type { TaskEventBucketType } from "@/types/tasks";
import { createClient } from "@/utils/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  api: {
    responseLimit: false,
  },
};

export const POST = async (request: NextRequest) => {
  try {
    const sessionData = (await request.json()) as TaskEventBucketType;
    if (!sessionData) {
      return NextResponse.json("No data provided", { status: 400 });
    }

    const newBlob = new Blob([JSON.stringify(sessionData)], {
      type: "application/json",
    });

    const uploadData = await uploadFileToBucket({
      bucketName: "recordings",
      filePath: `${sessionData.userId}/${sessionData.taskId}.json`,
      file: newBlob,
      upsert: true,
    });

    if (uploadData.error) {
      console.error("Error uploading file:", uploadData.error);
      return NextResponse.json("Error uploading file", {
        status: 500,
      });
    }
    const { data } = uploadData;
    if (!data) {
      await removeFilesFromBucket({
        bucketName: "recordings",
        filePaths: [`${sessionData.userId}/${sessionData.taskId}.json`],
      });

      return NextResponse.json("No data returned from upload", { status: 500 });
    }

    // get the size of the uploaded file
    const fileSize = newBlob.size;

    const inserted = await insertUploadDataToTaskTable({
      userId: sessionData.userId,
      taskId: data.id,
      path: data.path,
      fullPath: data.fullPath,
      fileSize: fileSize,
    });

    if (!inserted) {
      await removeFilesFromBucket({
        bucketName: "recordings",
        filePaths: [`${sessionData.userId}/${sessionData.taskId}.json`],
      });

      return NextResponse.json("Error inserting data into task table", {
        status: 500,
      });
    }

    const supabase = await createClient();
    const { data: taskStatuses, error } = await supabase
      .from("user_profiles")
      .select("task_statuses")
      .eq("id", sessionData.userId)
      .single();

    if (error) {
      // remove file
      await removeFilesFromBucket({
        bucketName: "recordings",
        filePaths: [`${sessionData.userId}/${sessionData.taskId}.json`],
      });

      // remove task data
      await removeUploadDataFromTaskTable({
        taskId: data.id,
        userId: sessionData.userId,
      });

      console.error("Error fetching task statuses:", error);
      return NextResponse.json("Error fetching task statuses", {
        status: 500,
      });
    }

    if (!taskStatuses) {
      // remove file
      await removeFilesFromBucket({
        bucketName: "recordings",
        filePaths: [`${sessionData.userId}/${sessionData.taskId}.json`],
      });

      // remove task data
      await removeUploadDataFromTaskTable({
        taskId: data.id,
        userId: sessionData.userId,
      });
      return NextResponse.json("No task statuses found", { status: 404 });
    }

    const taskStatusesObject = taskStatuses.task_statuses as Record<
      string,
      string
    >;
    const taskId = sessionData.taskId;
    const taskStatus = "completed";

    taskStatusesObject[taskId] = taskStatus;
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ task_statuses: taskStatusesObject })
      .eq("id", sessionData.userId);

    if (updateError) {
      // remove file
      await removeFilesFromBucket({
        bucketName: "recordings",
        filePaths: [`${sessionData.userId}/${sessionData.taskId}.json`],
      });

      // remove task data
      await removeUploadDataFromTaskTable({
        taskId: data.id,
        userId: sessionData.userId,
      });

      console.error("Error updating task status:", updateError);
      return NextResponse.json("Error updating task status", { status: 500 });
    }

    return NextResponse.json({
      message: "File uploaded and data inserted successfully",
      fileId: data.id,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json("Invalid JSON format", { status: 400 });
  }
};
