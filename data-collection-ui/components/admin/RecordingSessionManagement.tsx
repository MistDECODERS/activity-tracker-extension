"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Activity,
	Search,
	Download,
	Trash2,
	Filter,
	FileVideo,
	Eye,
	BarChart3,
	HardDrive,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "../shared/theme-toggle";

interface RecordingSession {
	id: string;
	userId: string;
	userEmail?: string;
	userName?: string;
	taskId: string;
	status: "in-progress" | "completed" | "stopped";
	startTime: string;
	endTime?: string;
	duration?: number;
	fileSize?: number;
	filePath?: string;
}

export function RecordingSessionManagement() {
	const router = useRouter();
	const [sessions, setSessions] = useState<RecordingSession[]>([]);
	const [filteredSessions, setFilteredSessions] = useState<RecordingSession[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [deleting, setDeleting] = useState<string | null>(null);
	const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
		new Set(),
	);
	const [bulkDeleting, setBulkDeleting] = useState(false);

	// Fetch sessions on component mount
	useEffect(() => {
		fetchSessions();
	}, []);

	const fetchSessions = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/admin/sessions");

			if (!response.ok) {
				throw new Error("Failed to fetch sessions");
			}

			const sessionData = await response.json();
			setSessions(sessionData);
		} catch (error) {
			console.error("Error fetching sessions:", error);
		} finally {
			setLoading(false);
		}
	};

	// Filter sessions based on search term and status filter
	useEffect(() => {
		let filtered = sessions;

		if (searchTerm) {
			filtered = filtered.filter(
				(session) =>
					session.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					session.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					session.taskId.toLowerCase().includes(searchTerm.toLowerCase()),
			);
		}

		if (statusFilter !== "all") {
			filtered = filtered.filter((session) => session.status === statusFilter);
		}

		setFilteredSessions(filtered);
	}, [sessions, searchTerm, statusFilter]);

	const deleteSession = async (sessionId: string) => {
		try {
			setDeleting(sessionId);

			const session = sessions.find((s) => s.id === sessionId);
			if (!session) return;

			const response = await fetch("/api/admin/sessions", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					sessionId,
					taskId: session.taskId,
					userId: session.userId,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to delete session");
			}

			// Remove session from local state
			setSessions((prev) => prev.filter((session) => session.id !== sessionId));
		} catch (error) {
			console.error("Error deleting session:", error);
		} finally {
			setDeleting(null);
		}
	};

	const downloadRecording = async (session: RecordingSession) => {
		try {
			const response = await fetch(
				`/api/admin/sessions/download?userId=${session.userId}&taskId=${session.taskId}`,
			);

			if (!response.ok) {
				throw new Error("Failed to download recording");
			}

			// Create a blob from the response
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);

			// Create a temporary download link
			const link = document.createElement("a");
			link.href = url;
			link.download = `${session.taskId}.json`;
			document.body.appendChild(link);
			link.click();

			// Cleanup
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Error downloading recording:", error);
		}
	};

	const viewRecording = (session: RecordingSession) => {
		router.push(
			`/dashboard/recordings?taskId=${session.taskId}&userId=${session.userId}`,
		);
	};

	const viewAnalytics = (session: RecordingSession) => {
		router.push(
			`/dashboard/analytics?taskId=${session.taskId}&userId=${session.userId}`,
		);
	};

	const toggleSessionSelection = (sessionId: string) => {
		const newSelected = new Set(selectedSessions);
		if (newSelected.has(sessionId)) {
			newSelected.delete(sessionId);
		} else {
			newSelected.add(sessionId);
		}
		setSelectedSessions(newSelected);
	};

	const toggleAllSessions = () => {
		if (selectedSessions.size === filteredSessions.length) {
			setSelectedSessions(new Set());
		} else {
			setSelectedSessions(new Set(filteredSessions.map((s) => s.id)));
		}
	};

	const bulkDeleteSessions = async () => {
		if (selectedSessions.size === 0) return;

		try {
			setBulkDeleting(true);

			const promises = Array.from(selectedSessions).map(async (sessionId) => {
				const session = sessions.find((s) => s.id === sessionId);
				if (!session) return;

				const response = await fetch("/api/admin/sessions", {
					method: "DELETE",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						sessionId,
						taskId: session.taskId,
						userId: session.userId,
					}),
				});

				if (!response.ok) {
					throw new Error(`Failed to delete session ${sessionId}`);
				}
			});

			await Promise.all(promises);

			// Remove sessions from local state
			setSessions((prev) =>
				prev.filter((session) => !selectedSessions.has(session.id)),
			);
			setSelectedSessions(new Set());
		} catch (error) {
			console.error("Error bulk deleting sessions:", error);
		} finally {
			setBulkDeleting(false);
		}
	};

	const bulkDownloadSessions = async () => {
		if (selectedSessions.size === 0) return;

		try {
			const promises = Array.from(selectedSessions).map(async (sessionId) => {
				const session = sessions.find((s) => s.id === sessionId);
				if (!session || !session.filePath) return;

				const response = await fetch(
					`/api/admin/sessions/download?userId=${session.userId}&taskId=${session.taskId}`,
				);

				if (!response.ok) {
					throw new Error(`Failed to download session ${sessionId}`);
				}

				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);

				const link = document.createElement("a");
				link.href = url;
				link.download = `${session.taskId}.json`;
				document.body.appendChild(link);
				link.click();

				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			});

			await Promise.all(promises);
		} catch (error) {
			console.error("Error bulk downloading sessions:", error);
		}
	};

	const formatFileSize = (bytes?: number) => {
		if (!bytes) return "N/A";
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(1)} MB`;
	};

	const formatTime = (dateString: string) => {
		return new Date(dateString).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "in-progress":
				return "bg-chart-1/10 text-chart-1 border-chart-1/20";
			case "completed":
				return "bg-chart-2/10 text-chart-2 border-chart-2/20";
			case "stopped":
				return "bg-destructive/10 text-destructive border-destructive/20";
			default:
				return "bg-muted/10 text-muted-foreground border-muted/20";
		}
	};

	// Calculate stats
	const inProgressCount = sessions.filter(
		(s) => s.status === "in-progress",
	).length;
	const completedCount = sessions.filter(
		(s) => s.status === "completed",
	).length;
	const totalStorageUsed = sessions.reduce(
		(total, session) => total + (session.fileSize || 0),
		0,
	);
	const totalRecordings = sessions.length;

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-chart-1" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Activity className="h-8 w-8 text-chart-2" />
				<h1 className="text-3xl font-bold">Recording Session Management</h1>
				<Badge variant="secondary" className="ml-2">
					Admin Access
				</Badge>
				<div className="ml-auto flex items-center gap-4">
					<ThemeToggle />
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">In-Progress</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-chart-1">
							{inProgressCount}
						</div>
						<p className="text-xs text-muted-foreground">Currently recording</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Completed</CardTitle>
						<FileVideo className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-chart-2">
							{completedCount}
						</div>
						<p className="text-xs text-muted-foreground">Finished recordings</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Storage Used</CardTitle>
						<HardDrive className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-chart-1">
							{formatFileSize(totalStorageUsed)}
						</div>
						<p className="text-xs text-muted-foreground">Total file size</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Recordings
						</CardTitle>
						<FileVideo className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-chart-2">
							{totalRecordings}
						</div>
						<p className="text-xs text-muted-foreground">Files available</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters and Search */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Filter className="h-5 w-5" />
						Filters & Search
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col sm:flex-row gap-4">
						{/* Search Input */}
						<div className="flex-1 relative">
							<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by user, email, or task ID..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-8"
							/>
						</div>

						{/* Status Filter */}
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="in-progress">In Progress</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="stopped">Stopped</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Sessions Table */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>
							Recording Sessions ({filteredSessions.length})
						</CardTitle>
						{selectedSessions.size > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground">
									{selectedSessions.size} selected
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={bulkDownloadSessions}
								>
									<Download className="h-4 w-4 mr-2" />
									Download Selected
								</Button>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="outline" size="sm" disabled={bulkDeleting}>
											{bulkDeleting ? (
												<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
											) : (
												<Trash2 className="h-4 w-4 mr-2" />
											)}
											Delete Selected
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Delete Selected Sessions
											</AlertDialogTitle>
											<AlertDialogDescription>
												Are you sure you want to delete {selectedSessions.size}{" "}
												recording sessions? This action cannot be undone and
												will permanently remove all selected recording data.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={bulkDeleteSessions}
												className="bg-destructive hover:bg-destructive/90"
											>
												Delete {selectedSessions.size} Sessions
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-12">
										<Checkbox
											checked={
												selectedSessions.size === filteredSessions.length &&
												filteredSessions.length > 0
											}
											onCheckedChange={toggleAllSessions}
										/>
									</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Task ID</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Started</TableHead>
									<TableHead>File Size</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredSessions.map((session) => (
									<TableRow key={session.id + session.userId}>
										<TableCell>
											<Checkbox
												checked={selectedSessions.has(session.id)}
												onCheckedChange={() =>
													toggleSessionSelection(session.id)
												}
											/>
										</TableCell>
										<TableCell>
											<div>
												<p className="font-medium">
													{session.userName || "Unknown"}
												</p>
												<p className="text-sm text-muted-foreground">
													{session.userEmail}
												</p>
											</div>
										</TableCell>
										<TableCell className="font-mono text-sm">
											{session.taskId}
										</TableCell>
										<TableCell>
											<Badge
												className={getStatusColor(session.status)}
												variant="outline"
											>
												{session.status}
											</Badge>
										</TableCell>
										<TableCell>
											{session.startTime ? formatTime(session.startTime) : "-"}
										</TableCell>
										<TableCell>
											{session.fileSize
												? formatFileSize(session.fileSize)
												: "-"}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												{/* For completed tasks - View and Analytics buttons */}
												{session.status === "completed" && (
													<>
														<Button
															variant="outline"
															size="sm"
															onClick={() => viewRecording(session)}
															title="View Recording"
														>
															<Eye className="h-4 w-4" />
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() => viewAnalytics(session)}
															title="View Analytics"
														>
															<BarChart3 className="h-4 w-4" />
														</Button>
													</>
												)}

												{/* Delete Button */}
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															disabled={deleting === session.id}
															title="Delete Session"
														>
															{deleting === session.id ? (
																<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
															) : (
																<Trash2 className="h-4 w-4" />
															)}
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Delete Recording Session
															</AlertDialogTitle>
															<AlertDialogDescription>
																Are you sure you want to delete this recording
																session? This action cannot be undone and will
																permanently remove the recording data.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																disabled
																onClick={() => deleteSession(session.id)}
																className="bg-destructive hover:bg-destructive/90"
															>
																Delete Session
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
