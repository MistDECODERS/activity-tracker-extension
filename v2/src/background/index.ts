import Browser from "webextension-polyfill";
import { nanoid } from "nanoid";
import type { eventWithTime } from "@rrweb/types";
import Channel from "~/utils/channel";
import {
  EventName,
  LocalDataKey,
  MessageName,
  RecorderStatus,
  ServiceName,
  SyncDataKey,
} from "~/types";
import type {
  LocalData,
  RecordStartedMessage,
  RecordStoppedMessage,
  Session,
  Settings,
  SyncData,
} from "~/types";
import { isFirefox } from "~/utils";
import { getAuthInfo, getAuthStatus } from "~/utils/auth";
import { getInProgressTaskId } from "~/utils/tasks";
import { AXIOS } from "~/lib/axios";

void (async () => {
  const channel = new Channel();
  // auth status
  let authStatus: {
    isAuthenticated: boolean;
    userId: string | null;
    email: string | null;
    taskId: string | null;
  } = {
    isAuthenticated: false,
    userId: null,
    email: null,
    taskId: null,
  };

  // Upload status tracking
  let isUploading = false;

  // initialize auth status
  const initializeAuthStatus = async () => {
    try {
      console.log("Initializing auth status...");

      // Get auth status first
      const isAuth = await getAuthStatus();
      console.log("Auth status:", isAuth);

      if (isAuth) {
        try {
          // Get user info and task ID in parallel
          const [authInfo, taskId] = await Promise.all([
            getAuthInfo(),
            getInProgressTaskId().catch(() => null), // Don't fail if no task
          ]);

          authStatus = {
            isAuthenticated: true,
            userId: authInfo.userId,
            email: authInfo.email,
            taskId: taskId || null,
          };

          console.log("Auth initialized successfully:", authStatus);
        } catch (error) {
          console.error("Error getting auth details:", error);
          // Keep authenticated but clear other data
          authStatus = {
            isAuthenticated: true,
            userId: null,
            email: null,
            taskId: null,
          };
        }
      } else {
        authStatus = {
          isAuthenticated: false,
          userId: null,
          email: null,
          taskId: null,
        };
        console.log("User not authenticated");
      }

      // Always emit status change
      channel.emit(EventName.AuthStatusChanged, authStatus);
      console.log("Auth status emitted:", authStatus);
    } catch (error) {
      console.error("Failed to initialize auth status:", error);
      authStatus = {
        isAuthenticated: false,
        userId: null,
        email: null,
        taskId: null,
      };
      channel.emit(EventName.AuthStatusChanged, authStatus);
    }
  };

  // Handle auth status requests
  channel.on(EventName.AuthStatusRequested, async () => {
    console.log("Auth status requested, refreshing...");
    await initializeAuthStatus();
  });

  // Provide auth status service
  channel.provide("getAuthStatus", async () => {
    console.log("Auth status service called, current status:", authStatus);

    // If status is stale or empty, refresh it
    if (!authStatus.isAuthenticated && !authStatus.userId) {
      console.log("Status seems stale, refreshing...");
      await initializeAuthStatus();
    }

    return authStatus;
  });

  // Periodically check auth status with better logic
  setInterval(async () => {
    const previousAuth = authStatus.isAuthenticated;
    const previousTaskId = authStatus.taskId;

    try {
      await initializeAuthStatus();

      // Only emit if something actually changed
      if (
        previousAuth !== authStatus.isAuthenticated ||
        previousTaskId !== authStatus.taskId
      ) {
        console.log("Auth status changed during periodic check");
        channel.emit(EventName.AuthStatusChanged, authStatus);
      }
    } catch (error) {
      console.error("Error during periodic auth check:", error);
    }
  }, 30000); // Check every 30 seconds

  // Initialize auth status on extension load
  console.log("Extension starting, initializing auth...");
  await initializeAuthStatus();

  // assign default value to settings of this extension
  const result =
    ((await Browser.storage.sync.get(SyncDataKey.settings)) as SyncData) ||
    undefined;

  const defaultSettings: Settings = {};

  let settings = defaultSettings;

  if (result && result.settings) {
    setDefaultSettings(result.settings, defaultSettings);
    settings = result.settings;
  }

  await Browser.storage.sync.set({
    settings,
  } as SyncData);

  const events: eventWithTime[] = [];

  let recorderStatus: LocalData[LocalDataKey.recorderStatus] = {
    status: RecorderStatus.IDLE,
    activeTabId: -1,
  };

  // Reset recorder status when the extension is reloaded.
  await Browser.storage.local.set({
    [LocalDataKey.recorderStatus]: recorderStatus,
  });

  // Listen to the start recording events.
  channel.on(EventName.StartButtonClicked, async () => {
    if (recorderStatus.status !== RecorderStatus.IDLE) return;
    recorderStatus = {
      status: RecorderStatus.IDLE,
      activeTabId: -1,
    };
    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });

    events.length = 0; // clear events before recording
    const tabId = await channel.getCurrentTabId();
    if (tabId === -1) return;

    const res = (await channel
      .requestToTab(tabId, ServiceName.StartRecord, {})
      .catch(async (error: Error) => {
        recorderStatus.errorMessage = error.message;
        await Browser.storage.local.set({
          [LocalDataKey.recorderStatus]: recorderStatus,
        });
      })) as RecordStartedMessage;

    if (!res) return;

    Object.assign(recorderStatus, {
      status: RecorderStatus.RECORDING,
      activeTabId: tabId,
      startTimestamp: res.startTimestamp,
    });
    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });
  });

  // Listen to the stop recording events with better task ID handling
  channel.on(EventName.StopButtonClicked, async () => {
    if (recorderStatus.status === RecorderStatus.IDLE) return;

    if (recorderStatus.status === RecorderStatus.RECORDING)
      (await channel
        .requestToTab(recorderStatus.activeTabId, ServiceName.StopRecord, {})
        .catch(() => ({
          message: MessageName.RecordStopped,
          endTimestamp: Date.now(),
        }))) as RecordStoppedMessage;

    recorderStatus = {
      status: RecorderStatus.IDLE,
      activeTabId: -1,
    };

    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });

    const title =
      (await Browser.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => tabs[0]?.title)
        .catch(() => {
          // ignore error
        })) ?? "new session";

    const newSession = generateSession(title);

    // Emit uploading started
    isUploading = true;
    channel.emit(EventName.UploadingStarted, {});

    try {
      // Get fresh auth info and task ID
      const [userInfo, taskId] = await Promise.all([
        getAuthInfo(),
        getInProgressTaskId(),
      ]);

      console.log("Uploading with taskId:", taskId);

      await AXIOS.post("/tasks", {
        userId: userInfo.userId,
        taskId,
        events,
        session: newSession,
      });

      // Clear taskId after successful upload and refresh auth status
      await initializeAuthStatus(); // This will update taskId

      channel.emit(EventName.UploadingFinished, { session: newSession });
      channel.emit(EventName.SessionUpdated, { session: newSession });

      console.log("Upload successful, auth status refreshed");
    } catch (error) {
      console.error("Upload failed:", error);
      channel.emit(EventName.UploadingFailed, {
        error: error instanceof Error ? error.message : "Upload failed",
      });
      recorderStatus.errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      await Browser.storage.local.set({
        [LocalDataKey.recorderStatus]: recorderStatus,
      });
    } finally {
      isUploading = false;
      events.length = 0;
    }
  });

  /**
   * Pause the recording in the current tab.
   * @param newStatus - the new status of the recorder after pausing
   */
  async function pauseRecording(newStatus: RecorderStatus) {
    if (
      recorderStatus.status !== RecorderStatus.RECORDING ||
      recorderStatus.activeTabId === -1
    )
      return;

    const stopResponse = (await channel
      .requestToTab(recorderStatus.activeTabId, ServiceName.StopRecord, {})
      .catch(() => {
        // ignore error
      })) as RecordStoppedMessage | undefined;
    Object.assign(recorderStatus, {
      status: newStatus,
      activeTabId: -1,
      pausedTimestamp: stopResponse?.endTimestamp,
    });
    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });
  }
  channel.on(EventName.PauseButtonClicked, async () => {
    if (recorderStatus.status !== RecorderStatus.RECORDING) return;
    await pauseRecording(RecorderStatus.PAUSED);
  });

  /**
   * Resume the recording in the new tab.
   * @param newTabId - the id of the new tab to resume recording
   */
  async function resumeRecording(newTabId: number) {
    if (
      ![RecorderStatus.PAUSED, RecorderStatus.PausedSwitch].includes(
        recorderStatus.status
      )
    )
      return;
    const { startTimestamp, pausedTimestamp } = recorderStatus;
    // On Firefox, the new tab is not communicable immediately after it is created.
    if (isFirefox()) await new Promise((r) => setTimeout(r, 50));
    const pausedTime = pausedTimestamp ? Date.now() - pausedTimestamp : 0;
    // Decrease the time spent in the pause state and make them look like a continuous recording.
    events.forEach((event) => {
      event.timestamp += pausedTime;
    });

    const startResponse = (await channel
      .requestToTab(newTabId, ServiceName.StartRecord, {})
      .catch((e: { message: string }) => {
        recorderStatus.errorMessage = e.message;
        void Browser.storage.local.set({
          [LocalDataKey.recorderStatus]: recorderStatus,
        });
      })) as RecordStartedMessage | undefined;

    if (!startResponse) {
      // Restore the events data when the recording fails to start.
      events.forEach((event) => {
        event.timestamp -= pausedTime;
      });
      return;
    }

    recorderStatus = {
      status: RecorderStatus.RECORDING,
      activeTabId: newTabId,
      startTimestamp: (startTimestamp || Date.now()) + pausedTime,
    };

    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });
  }

  channel.on(EventName.ResumeButtonClicked, async () => {
    if (recorderStatus.status !== RecorderStatus.PAUSED) return;
    recorderStatus.errorMessage = undefined;
    await Browser.storage.local.set({
      [LocalDataKey.recorderStatus]: recorderStatus,
    });
    const tabId = await channel.getCurrentTabId();
    await resumeRecording(tabId);
  });

  channel.on(EventName.ContentScriptEmitEvent, (data) => {
    events.push(data as eventWithTime);
  });

  // When tab is changed during the recording process, pause recording in the old tab and start a new one in the new tab.
  Browser.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
      if (
        recorderStatus.status !== RecorderStatus.RECORDING &&
        recorderStatus.status !== RecorderStatus.PausedSwitch
      )
        return;
      if (activeInfo.tabId === recorderStatus.activeTabId) return;
      if (recorderStatus.status === RecorderStatus.RECORDING)
        await pauseRecording(RecorderStatus.PausedSwitch);
      if (recorderStatus.status === RecorderStatus.PausedSwitch)
        await resumeRecording(activeInfo.tabId);
    })();
    return;
  });

  // If the recording can't start on an invalid tab, resume it when the tab content is updated.
  Browser.tabs.onUpdated.addListener(function (tabId, info) {
    if (info.status !== "complete") return;
    if (
      recorderStatus.status !== RecorderStatus.PausedSwitch ||
      recorderStatus.activeTabId === tabId
    )
      return;
    void resumeRecording(tabId);
  });

  /**
   * When the current tab is closed, and there's no other tab to resume recording, make sure the recording status is updated to SwitchPaused.
   */
  Browser.tabs.onRemoved.addListener((tabId) => {
    void (async () => {
      if (
        recorderStatus.activeTabId !== tabId ||
        recorderStatus.status !== RecorderStatus.RECORDING
      )
        return;
      // Update the recording status to make it resumable after users switch to other tabs.
      Object.assign(recorderStatus, {
        status: RecorderStatus.PausedSwitch,
        activeTabId: -1,
        pausedTimestamp: Date.now(),
      });

      await Browser.storage.local.set({
        [LocalDataKey.recorderStatus]: recorderStatus,
      });
    })();
  });
})();

/**
 * Update existed settings with new settings.
 * Set new setting values if these properties don't exist in older versions.
 */
function setDefaultSettings(
  existedSettings: Record<string, unknown>,
  newSettings: Record<string, unknown>
) {
  for (const i in newSettings) {
    // settings[i] contains key-value settings
    if (
      typeof newSettings[i] === "object" &&
      !Array.isArray(newSettings[i]) &&
      Object.keys(newSettings[i] as Record<string, unknown>).length > 0
    ) {
      if (existedSettings[i]) {
        setDefaultSettings(
          existedSettings[i] as Record<string, unknown>,
          newSettings[i] as Record<string, unknown>
        );
      } else {
        // settings[i] contains several setting items but these have not been set before
        existedSettings[i] = newSettings[i];
      }
    } else if (existedSettings[i] === undefined) {
      // settings[i] is a single setting item and it has not been set before
      existedSettings[i] = newSettings[i];
    }
  }
}

function generateSession(title: string) {
  const newSession: Session = {
    id: nanoid(),
    name: title,
    tags: [],
    createTimestamp: Date.now(),
    modifyTimestamp: Date.now(),
    recorderVersion: Browser.runtime.getManifest().version_name || "unknown",
  };
  return newSession;
}
