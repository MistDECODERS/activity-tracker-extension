import { createClient } from "@/utils/supabase/server";
import { listFilesInBucket, removeFilesFromBucket } from "./bucket";

export const insertUploadDataToTaskTable = async ({
  taskId,
  userId,
  path,
  fullPath,
  fileSize,
}: {
  taskId: string;
  userId: string;
  path: string;
  fullPath: string;
  fileSize: number;
}): Promise<boolean> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      fileId: taskId,
      user_id: userId,
      path,
      fullPath,
      file_size: fileSize,
    })
    .select();

  if (error) {
    console.error("Error inserting data:", error);
    return false;
  }

  if (!data) {
    console.error("No data returned from insert");
    return false;
  }

  return true;
};

export const removeUploadDataFromTaskTable = async ({
  taskId,
  userId,
  allRows = false,
}: {
  taskId: string;
  userId: string;
  allRows?: boolean;
}): Promise<boolean> => {
  const supabase = await createClient();
  let error = null;

  if (!allRows) {
    const response = await supabase
      .from("tasks")
      .delete()
      .eq("fileId", taskId)
      .eq("user_id", userId);

    error = response.error;
  } else {
    const response = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", userId);

    error = response.error;
  }

  if (error) {
    console.error("Error deleting data:", error);
    return false;
  }

  return true;
};

export const resetProgress = async ({
  userId,
  bucketName,
}: {
  userId: string;
  bucketName: string;
}): Promise<boolean> => {
  // remove files from bucket
  // list files the folder
  const { data, error } = await listFilesInBucket({
    bucketName,
    folderPath: userId,
  });

  if (error) {
    console.error("Error listing files in bucket:", error);
    return false;
  }

  if (!data || data.length === 0) {
    console.log("No files found in the bucket for the user.");
    return true;
  }

  // delete each file
  const { data: deleteData, error: deleteError } = await removeFilesFromBucket({
    bucketName,
    filePaths: data.map((file) => `${userId}/${file.name}`),
  });

  if (deleteError) {
    console.error("Error deleting files from bucket:", deleteError);
    return false;
  }

  // remove data from tasks table
  const removeDataResult = await removeUploadDataFromTaskTable({
    taskId: userId,
    userId,
    allRows: true,
  });

  if (!removeDataResult) {
    console.error("Error removing data from tasks table");
    return false;
  }

  // reset task status
  const supabase = await createClient();
  const { error: taskError } = await supabase
    .from("user_profiles")
    .update({
      task_statuses: {},
    })
    .eq("id", userId);

  if (taskError) {
    console.error("Error resetting task statuses:", taskError);
    return false;
  }

  return true;
};
