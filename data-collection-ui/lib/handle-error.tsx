"use client";
import { toast } from "sonner";

export function useErrorHandler() {
  const handleError = (error: Error, description: string) => {
    // Check if it's a Next.js redirect (which is expected behavior)
    if (error?.message?.startsWith("NEXT_REDIRECT")) {
      // This is a successful redirect, not an error
      return;
    }

    const message =
      error instanceof Error ? error.message : "An error occurred";

    toast.error(message, {
      description: description || "Something went wrong. Please try again.",
    });
  };

  return { handleError };
}
