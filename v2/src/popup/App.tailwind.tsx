import { useState, useEffect } from "react";
import Browser from "webextension-polyfill";
import { ListIcon, Pause, Play, Loader2, RefreshCw } from "lucide-react";
import Channel from "~/utils/channel";
import { LocalDataKey, RecorderStatus, EventName } from "~/types";
import type { LocalData, Session } from "~/types";

import { CircleButton } from "~/components/ui/circle-button";
import { Timer } from "~/components/ui/timer";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { config } from "~/config";
// Fix the import path - use lowercase 'auth-channel'
import { useAuthChannel, type AuthStatus } from "~/utils/auth-channel";

const RECORD_BUTTON_SIZE = 4;
const channel = new Channel();

export function App() {
  const [status, setStatus] = useState<RecorderStatus>(RecorderStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { requestAuthStatus, onAuthStatusChange, refreshAuthStatus } =
    useAuthChannel();

  const handleAuthStatusUpdate = (authData: AuthStatus) => {
    console.log("Popup: Handling auth status update:", authData);
    setIsAuthenticated(authData.isAuthenticated);
    setTaskId(authData.taskId);

    if (!authData.isAuthenticated) {
      setStatus(RecorderStatus.IDLE);
      setStartTime(0);
      setNewSession(null);
      setErrorMessage("Not authenticated");
    } else {
      // Clear error message when authenticated
      setErrorMessage("");
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoadingAuth(true);
      try {
        console.log("Popup: Requesting auth status...");
        const authStatus = await requestAuthStatus();
        console.log("Popup: Received auth status:", authStatus);
        handleAuthStatusUpdate(authStatus);
      } catch (error) {
        console.error("Popup: Error initializing auth:", error);
        toast.error("Error loading authentication status");
      } finally {
        setIsLoadingAuth(false);
      }
    };

    // Listen for auth status changes
    const removeAuthListener = onAuthStatusChange(handleAuthStatusUpdate);

    // Listen for upload status
    const removeUploadStartListener = channel.on(
      EventName.UploadingStarted,
      () => {
        setIsUploading(true);
        toast.info("Uploading recording...");
      }
    );

    const removeUploadFinishListener = channel.on(
      EventName.UploadingFinished,
      async (data) => {
        setIsUploading(false);
        const sessionData = data as { session: Session };
        setNewSession(sessionData.session);
        toast.success("Recording uploaded successfully!");

        // Refresh auth status to get updated taskId
        console.log("Popup: Upload finished, refreshing auth status...");
        try {
          const updatedAuth = await refreshAuthStatus();
          handleAuthStatusUpdate(updatedAuth);
        } catch (error) {
          console.error("Error refreshing auth after upload:", error);
        }
      }
    );

    const removeUploadFailListener = channel.on(
      EventName.UploadingFailed,
      (data) => {
        setIsUploading(false);
        const errorData = data as { error: string };
        toast.error(`Upload failed: ${errorData.error}`);
      }
    );

    const parseStatusData = (data: LocalData[LocalDataKey.recorderStatus]) => {
      const { status, startTimestamp, pausedTimestamp } = data;
      setStatus(status);
      if (startTimestamp && pausedTimestamp)
        setStartTime(Date.now() - pausedTimestamp + startTimestamp);
      else if (startTimestamp) setStartTime(startTimestamp);
    };

    void Browser.storage.local.get(LocalDataKey.recorderStatus).then((data) => {
      if (!data || !data[LocalDataKey.recorderStatus]) return;
      parseStatusData((data as LocalData)[LocalDataKey.recorderStatus]);
    });

    const storageChangeListener = (changes: { [key: string]: any }) => {
      if (!changes[LocalDataKey.recorderStatus]) return;
      const data = changes[LocalDataKey.recorderStatus]
        .newValue as LocalData[LocalDataKey.recorderStatus];
      parseStatusData(data);
      if (data.errorMessage) setErrorMessage(data.errorMessage);
    };

    Browser.storage.local.onChanged.addListener(storageChangeListener);

    const removeSessionUpdateListener = channel.on(
      EventName.SessionUpdated,
      (data) => {
        setNewSession((data as { session: Session }).session);
      }
    );

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason &&
        typeof event.reason.message === "string" &&
        (event.reason.message.includes("Could not establish connection") ||
          event.reason.message.includes("Receiving end does not exist"))
      ) {
        setConnectionError(true);
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Initialize auth
    void initializeAuth();

    return () => {
      // Call the cleanup functions properly
      if (typeof removeAuthListener === "function") {
        removeAuthListener();
      }
      if (typeof removeUploadStartListener === "function") {
        removeUploadStartListener();
      }
      if (typeof removeUploadFinishListener === "function") {
        removeUploadFinishListener();
      }
      if (typeof removeUploadFailListener === "function") {
        removeUploadFailListener();
      }
      if (typeof removeSessionUpdateListener === "function") {
        removeSessionUpdateListener();
      }

      Browser.storage.local.onChanged.removeListener(storageChangeListener);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  const safeEmit = async (eventName: EventName, data: unknown) => {
    try {
      await channel.emit(eventName, data);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Could not establish connection") ||
          error.message.includes("Receiving end does not exist"))
      ) {
        setConnectionError(true);
      }
    }
  };

  const handleRecordingAction = (action: string) => {
    try {
      if (action === "start" && status === RecorderStatus.IDLE) {
        void safeEmit(EventName.StartButtonClicked, {});
      } else if (action === "stop") {
        void safeEmit(EventName.StopButtonClicked, {});
      } else if (action === "pause" && status === RecorderStatus.RECORDING) {
        void safeEmit(EventName.PauseButtonClicked, {});
      } else if (action === "resume") {
        void safeEmit(EventName.ResumeButtonClicked, {});
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Could not establish connection") ||
          error.message.includes("Receiving end does not exist"))
      ) {
        setConnectionError(true);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log("Manual refresh triggered");
      toast.info("Refreshing auth status...");

      // Force refresh auth status
      const updatedAuth = await refreshAuthStatus();
      console.log(updatedAuth)
      handleAuthStatusUpdate(updatedAuth);

      toast.success("Auth status refreshed");
      console.log("Manual refresh completed:", updatedAuth);
    } catch (error) {
      console.error("Error during manual refresh:", error);
      toast.error("Failed to refresh auth status");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show loading indicator while authenticating
  if (isLoadingAuth) {
    return (
      <div className="flex flex-col w-[300px] h-[300px] p-[5%] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-gray-600 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[300px] h-[300px] p-[5%]">
      <div className="flex">
        <p className="text-md font-bold">ScreenTrail Recorder</p>
        <div className="flex-1" />
        <div className="flex flex-row space-x-2">
          {isAuthenticated && (
            <>
              <Button
                onClick={() => {
                  window.open(`${config.SITE_URL}/dashboard/tasks`, "_blank");
                }}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Session List"
              >
                <ListIcon className="h-4 w-4" />
                <span className="sr-only">Session List</span>
              </Button>

              <Button
                onClick={handleManualRefresh}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Refresh Auth Status"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="sr-only">Refresh Auth Status</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {status !== RecorderStatus.IDLE && startTime && (
        <Timer
          startTime={startTime}
          ticking={status === RecorderStatus.RECORDING}
        />
      )}

      {isAuthenticated ? (
        <div className="flex justify-center items-center gap-10 mt-5 mb-5">
          <CircleButton
            disabled={taskId === null || isUploading}
            diameter={RECORD_BUTTON_SIZE}
            title={
              status === RecorderStatus.IDLE
                ? "Start Recording"
                : "Stop Recording"
            }
            onClick={() =>
              handleRecordingAction(
                status === RecorderStatus.IDLE ? "start" : "stop"
              )
            }
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            ) : (
              <div
                style={{
                  width: `${RECORD_BUTTON_SIZE}rem`,
                  height: `${RECORD_BUTTON_SIZE}rem`,
                  margin: 0,
                  backgroundColor: "rgb(239, 68, 68)", // red-500
                  borderRadius:
                    status === RecorderStatus.IDLE ? "9999px" : "0.375rem",
                }}
              />
            )}
          </CircleButton>

          {status !== RecorderStatus.IDLE && (
            <CircleButton
              diameter={RECORD_BUTTON_SIZE}
              title={
                status === RecorderStatus.RECORDING
                  ? "Pause Recording"
                  : "Resume Recording"
              }
              onClick={() =>
                handleRecordingAction(
                  status === RecorderStatus.RECORDING ? "pause" : "resume"
                )
              }
            >
              <div className="flex items-center justify-center w-full h-full">
                {[RecorderStatus.PAUSED, RecorderStatus.PausedSwitch].includes(
                  status
                ) && (
                  <Play
                    className="h-6 w-6 text-gray-600"
                    style={{ marginLeft: "2px" }}
                  />
                )}
                {status === RecorderStatus.RECORDING && (
                  <Pause className="h-6 w-6 text-gray-600" />
                )}
              </div>
            </CircleButton>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center mt-5 mb-5">
          <p className="text-sm font-medium">You are not logged in</p>
          <Button
            onClick={() => {
              window.open(`${config.SITE_URL}/auth?tab=login`, "_blank");
            }}
            className="mt-2"
            variant="outline"
            size="sm"
          >
            Log In
          </Button>
        </div>
      )}

      {newSession && (
        <div className="flex flex-col mt-2 p-4 rounded-md border border-gray-200">
          <p className="text-sm font-medium">New session created</p>
          <Button
            onClick={() => {
              window.open(
                `${config.SITE_URL}/dashboard/recordings?taskId=${taskId}`,
                "_blank"
              );
              setNewSession(null);
            }}
            className="mt-2"
            variant="outline"
            size="sm"
          >
            View Session
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-2 p-4 rounded-md border border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {taskId && (
        <div className="mt-2 p-4 rounded-md border border-teal-200 bg-teal-50">
          <p className="text-sm text-teal-600">{`Recording Session for TaskId: ${taskId}`}</p>
        </div>
      )}

      {connectionError && (
        <div className="mt-2 p-4 rounded-md border border-red-200 bg-red-50">
          <p className="text-sm text-red-600 mb-2">
            Could not establish connection. The page may need to be refreshed.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:bg-red-100"
            onClick={() => {
              Browser.tabs
                .query({ active: true, currentWindow: true })
                .then((tabs) => {
                  if (tabs[0]?.id) {
                    return Browser.tabs.reload(tabs[0].id);
                  }
                })
                .then(() => {
                  setConnectionError(false);
                })
                .catch(() => {
                  setConnectionError(false);
                });
            }}
          >
            Refresh Page
          </Button>
        </div>
      )}
    </div>
  );
}
