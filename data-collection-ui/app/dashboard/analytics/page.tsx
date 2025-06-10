"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session } from "@/components/analytics/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Replayer } from "rrweb";

// Import modular components
import NetworkTab from "@/components/analytics/NetworkTab";
import TimelineTab from "@/components/analytics/TimelineTab";

// Import types
import type { EventWithScreenshots } from "@/components/analytics/types";
import {
	extractStructuredData,
	type AIAgentTrainingData,
} from "@/components/analytics/extraction";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { downloadFileFromBucket } from "@/actions/bucket";
import { toast } from "sonner";
import type { TaskEventBucketType } from "@/types/tasks";
import { useErrorHandler } from "@/lib/handle-error";

// Import utilities

const Analytics: React.FC = () => {
	const params = useSearchParams();
	const id = params.get("taskId") as string;
	const paramUserId = params.get("userId") as string;
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("network");
	const replayerRef = useRef<Replayer | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [error, setError] = useState<string | null>(null);
	const supabase = createClient();
	const { handleError } = useErrorHandler();

	// Data structures for analytics
	const [networkData, setNetworkData] = useState<EventWithScreenshots[]>([]);
	const [recordingDuration, setRecordingDuration] = useState<number>(0);
	const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const [allEvents, setAllEvents] = useState<any[]>([]);
	const [structuredData, setStructuredData] = useState<AIAgentTrainingData>();

	const fetchRecordingData = async () => {
		try {
			setLoading(true);
			let userId: string;
			if (paramUserId) {
				userId = paramUserId;
			} else {
				userId = (await supabase.auth.getUser()).data.user?.id as string;
			}
      
			const { data, error } = await downloadFileFromBucket({
				bucketName: "recordings",
				filePath: `${userId}/${id}.json`,
			});

			//   printIfDev({ errorObject: data });

			if (error) {
				toast.error("Failed to fetch recording data. Please try again.", {
					description: error.message,
				});

				// printIfDev(error);

				setError("Failed to fetch recording data. Please try again.");
				return;
			}

			// turn blob to json
			if (data) {
				try {
					const jsonText = await data.text();
					const jsonData = JSON.parse(jsonText) as TaskEventBucketType;

					setSession(jsonData.session);
					setAllEvents(jsonData.events || []);
					const tempStructuredData = extractStructuredData(jsonData.events);
					setStructuredData(tempStructuredData);

					// Find the start and end timestamps from events
					if (jsonData.events && jsonData.events.length > 0) {
						const startTime = jsonData.events[0].timestamp;
						const endTime =
							jsonData.events[jsonData.events.length - 1].timestamp;
						setRecordingStartTime(startTime);
						setRecordingDuration(Math.round((endTime - startTime) / 1000));
					}

					setLoading(false);

					//   printIfDev({
					//     errorObject: jsonData,
					//   });
				} catch (parseError) {
					console.error("Failed to parse JSON data:", parseError);
					toast.error("Failed to parse recording data", {
						description:
							"The recording file appears to be corrupted or in an invalid format.",
					});
					setError(
						"Failed to parse recording data. The file may be corrupted.",
					);
				}
			}
		} catch (error) {
			handleError(error as Error, "Failed to fetch recording data");
			setError("Failed to fetch recording data. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!id) return;
		fetchRecordingData();
	}, [id]);

	// Initialize hidden replayer for screenshots
	useEffect(() => {
		if (allEvents.length > 0 && containerRef.current) {
			try {
				// Create a hidden replayer
				const replayer = new Replayer(allEvents, {
					root: containerRef.current,
					skipInactive: true,
					showWarning: false,
					showDebug: false,
					blockClass: "screenshot-block",
					liveMode: false,
				});

				// Store the replayer instance
				replayerRef.current = replayer;

				// Process events to identify interaction points
				processInteractionEvents();
			} catch (error) {
				console.error("Error initializing replayer:", error);
				handleError(error as Error, "Failed to initialize replayer");
			}
		}

		return () => {
			if (replayerRef.current) {
				// Clean up replayer
				replayerRef.current = null;
			}
		};
	}, [allEvents]);

	// Process events to identify interaction points
	const processInteractionEvents = () => {
		if (!allEvents.length) return;

		try {
			const processedNetworkData: EventWithScreenshots[] = [];

			// Process each event type
			for (let i = 0; i < allEvents.length; i++) {
				const event = allEvents[i];

				if (event.type === 5 && event.data?.tag === "custom") {
					const payload = event.data.payload;
					const timestamp = event.timestamp;
					const relativeTime = timestamp - recordingStartTime;
					const eventId = `event-${timestamp}-${Math.random()
						.toString(36)
						.substr(2, 9)}`;

					if (payload.type === "network") {
						// Process network request
						processedNetworkData.push({
							id: eventId,
							timestamp,
							relativeTime,
							type: "network",
							beforeScreenshot: null,
							afterScreenshot: null,
							data: payload.data,
						});
					}
				}
			}

			// Update state with processed data
			setNetworkData(processedNetworkData);
		} catch (error) {
			console.error("Error processing interaction events:", error);
			handleError(error as Error, "Failed to process interaction events");
		}
	};

	if (loading) {
		return (
			<div className="container mx-auto p-4">
				<Skeleton className="h-12 w-full mb-4 bg-card/60" />
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Skeleton className="h-48 w-full bg-card/60" />
					<Skeleton className="h-48 w-full bg-card/60" />
				</div>
				<div className="flex flex-col items-center justify-center mt-10">
					<p className="text-3xl font-bold text-chart-5">Task not found</p>
					<p>Please redirect to this page from Tasks Panel</p>
					<p className="text-muted-foreground">
						If you continue to see this message, please check your session.
					</p>
				</div>
			</div>
		);
	}

	if (!session) {
		return <div className="container mx-auto p-4">Session not found</div>;
	}

	return (
		<>
			<div className="container mx-auto p-4">
				<div className="flex flex-col gap-4">
					<h1 className="text-2xl font-bold">
						Session Analytics: {session.name}
					</h1>
					<p className="text-muted-foreground">
						Recorded on {new Date(session.createTimestamp).toLocaleString()} •
						Duration: {recordingDuration}s
					</p>

					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<TabsList className="grid grid-cols-8 mb-4">
							<TabsTrigger value="network">
								Network ({networkData.length})
							</TabsTrigger>
							<TabsTrigger value="timeline">Timeline</TabsTrigger>
						</TabsList>

						{/* Network Tab */}
						<TabsContent value="network">
							<NetworkTab
								networkData={networkData}
								allEvents={allEvents}
								recordingStartTime={recordingStartTime}
							/>
						</TabsContent>

						{/* Timeline Tab */}
						<TabsContent value="timeline">
							<TimelineTab
								structuredData={structuredData}
								networkData={networkData}
								allEvents={allEvents}
								recordingStartTime={recordingStartTime}
							/>
						</TabsContent>
					</Tabs>
				</div>
			</div>

			{/* Hidden container for replayer */}
			<div
				ref={containerRef}
				className="hidden"
				style={{
					position: "absolute",
					left: "-9999px",
					width: "1024px",
					height: "768px",
				}}
			/>
		</>
	);
};

export default Analytics;
