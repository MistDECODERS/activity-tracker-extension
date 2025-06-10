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
	Shield,
	Search,
	Filter,
	Activity,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import type { AuditLog } from "@/types/audit";
import { ThemeToggle } from "../shared/theme-toggle";

export function AuditLogViewer() {
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [actionFilter, setActionFilter] = useState<string>("all");
	const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [totalLogs, setTotalLogs] = useState(0);
	const [hasMore, setHasMore] = useState(false);

	const logsPerPage = 50;
	const offset = (currentPage - 1) * logsPerPage;

	// Fetch logs on component mount and when page changes
	useEffect(() => {
		fetchLogs();
	}, [currentPage, actionFilter, targetTypeFilter]);

	const fetchLogs = async () => {
		try {
			setLoading(true);

			const params = new URLSearchParams({
				limit: logsPerPage.toString(),
				offset: offset.toString(),
			});

			if (actionFilter !== "all") {
				params.append("action", actionFilter);
			}

			if (targetTypeFilter !== "all") {
				params.append("targetType", targetTypeFilter);
			}

			const response = await fetch(`/api/admin/audit?${params}`);

			if (!response.ok) {
				throw new Error("Failed to fetch audit logs");
			}

			const data = await response.json();
			setLogs(data.logs);
			setTotalLogs(data.total);
			setHasMore(data.hasMore);
		} catch (error) {
			console.error("Error fetching audit logs:", error);
		} finally {
			setLoading(false);
		}
	};

	// Filter logs based on search term
	useEffect(() => {
		let filtered = logs;

		if (searchTerm) {
			filtered = filtered.filter(
				(log) =>
					log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
					log.target_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					JSON.stringify(log.details)
						.toLowerCase()
						.includes(searchTerm.toLowerCase()),
			);
		}

		setFilteredLogs(filtered);
	}, [logs, searchTerm]);

	const formatTime = (dateString: string) => {
		return new Date(dateString).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const getActionColor = (action: string) => {
		switch (action) {
			case "update_user_role":
				return "bg-blue-100 text-blue-800";
			case "delete_session":
				return "bg-red-100 text-red-800";
			case "download_session":
				return "bg-green-100 text-green-800";
			case "bulk_delete_sessions":
				return "bg-red-100 text-red-800";
			case "create_admin":
				return "bg-purple-100 text-purple-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getTargetTypeColor = (targetType: string) => {
		switch (targetType) {
			case "user":
				return "bg-blue-100 text-blue-800";
			case "session":
				return "bg-green-100 text-green-800";
			case "system":
				return "bg-purple-100 text-purple-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const formatDetails = (details: Record<string, unknown>) => {
		const entries = Object.entries(details);
		if (entries.length === 0) return "No details";

		return entries
			.slice(0, 3) // Show first 3 details
			.map(([key, value]) => `${key}: ${value}`)
			.join(", ");
	};

	const totalPages = Math.ceil(totalLogs / logsPerPage);

	if (loading && logs.length === 0) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Shield className="h-8 w-8 text-blue-600" />
				<h1 className="text-3xl font-bold">Audit Logs</h1>
				<Badge variant="secondary" className="ml-2">
					Admin Access
				</Badge>
				<div className="ml-auto flex items-center gap-4">
					<ThemeToggle />
				</div>
			</div>

			{/* Stats Card */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Total Audit Entries
					</CardTitle>
					<Activity className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{totalLogs}</div>
					<p className="text-xs text-muted-foreground">
						Showing {offset + 1}-{Math.min(offset + logsPerPage, totalLogs)} of{" "}
						{totalLogs}
					</p>
				</CardContent>
			</Card>

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
								placeholder="Search logs..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-8"
							/>
						</div>

						{/* Action Filter */}
						<Select value={actionFilter} onValueChange={setActionFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by action" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Actions</SelectItem>
								<SelectItem value="update_user_role">
									Update User Role
								</SelectItem>
								<SelectItem value="delete_session">Delete Session</SelectItem>
								<SelectItem value="download_session">
									Download Session
								</SelectItem>
								<SelectItem value="bulk_delete_sessions">
									Bulk Delete
								</SelectItem>
								<SelectItem value="create_admin">Create Admin</SelectItem>
							</SelectContent>
						</Select>

						{/* Target Type Filter */}
						<Select
							value={targetTypeFilter}
							onValueChange={setTargetTypeFilter}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by target" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Targets</SelectItem>
								<SelectItem value="user">User</SelectItem>
								<SelectItem value="session">Session</SelectItem>
								<SelectItem value="system">System</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Audit Logs Table */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Audit Logs ({filteredLogs.length})</CardTitle>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
								disabled={currentPage === 1 || loading}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm text-muted-foreground">
								Page {currentPage} of {totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setCurrentPage(Math.min(totalPages, currentPage + 1))
								}
								disabled={!hasMore || loading}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Timestamp</TableHead>
									<TableHead>Admin</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Target</TableHead>
									<TableHead>Details</TableHead>
									<TableHead>IP Address</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredLogs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="font-mono text-sm">
											{formatTime(log.created_at)}
										</TableCell>
										<TableCell>
											<div>
												<p className="font-medium">{log.admin_email}</p>
												<p className="text-xs text-muted-foreground font-mono">
													{log.admin_user_id.slice(0, 8)}...
												</p>
											</div>
										</TableCell>
										<TableCell>
											<Badge className={getActionColor(log.action)}>
												{log.action.replace(/_/g, " ")}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Badge
													variant="outline"
													className={getTargetTypeColor(log.target_type)}
												>
													{log.target_type}
												</Badge>
												{log.target_id && (
													<span className="text-xs text-muted-foreground font-mono">
														{log.target_id.slice(0, 8)}...
													</span>
												)}
											</div>
										</TableCell>
										<TableCell className="max-w-xs">
											<div className="text-sm text-muted-foreground truncate">
												{formatDetails(log.details)}
											</div>
										</TableCell>
										<TableCell className="font-mono text-sm">
											{log.ip_address || "N/A"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					{loading && (
						<div className="flex justify-center items-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
