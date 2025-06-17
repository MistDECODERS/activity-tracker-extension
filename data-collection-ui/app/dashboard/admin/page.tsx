import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Users,
	FileText,
	HardDrive,
	Activity,
	UserCheck,
	Shield,
	BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";

async function getAdminStats(): Promise<{
	totalUsers: number;
	totalTasks: number;
	storageUsed: string;
	activeSessions: number;
	totalRecordings: number;
	recentUsers: Array<{
		id: string;
		fullName: string;
		email: string;
		role: string;
		created_at: string;
	}>;
	systemHealth: {
		database: boolean;
		storage: boolean;
	};
}> {
	try {
		const headersList = await headers();
		const cookie = headersList.get("cookie");
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/stats`,
			{
				cache: "no-store", // Ensure fresh data for admin dashboard
				headers: { Cookie: cookie || "" },
			},
		);

		if (!response.ok) {
			console.log("Failed to fetch admin stats:", response.statusText);
			throw new Error("Failed to fetch admin stats");
		}

		return await response.json();
	} catch (error) {
		console.error("Error fetching admin stats:", error);
		// Return default values if API fails
		return {
			totalUsers: 0,
			totalTasks: 0,
			storageUsed: "0 MB",
			activeSessions: 0,
			totalRecordings: 0,
			recentUsers: [],
			systemHealth: {
				database: false,
				storage: false,
			},
		};
	}
}

const AdminPage = async () => {
	// Ensure user is admin
	// await ensureAdmin();

	const stats = await getAdminStats();
	const systemHealth = stats.systemHealth;
	const hasIssues = !systemHealth.database || !systemHealth.storage;
	const colorClass = hasIssues ? "destructive" : "chart-5";

	return (
		<div className="flex-1 flex flex-col h-screen overflow-auto bg-background">
			<header className="border-b border-border/40 bg-card backdrop-blur supports-[backdrop-filter]:bg-card/60">
				<div className="flex h-14 items-center px-4 lg:px-8">
					<Shield className="h-8 w-8 text-chart-2" />
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<Badge variant="secondary" className="ml-2">
						Admin Access
					</Badge>
				</div>
			</header>

			<div className="p-6">
				{/* System Health Alert */}
				<div
					className={cn(
						"rounded-lg p-4 mb-6",
						hasIssues
							? "bg-destructive/10 border border-destructive/20"
							: "bg-chart-5/10 border border-chart-5/20",
					)}
				>
					<div className="flex items-center gap-2">
						<Activity className={`h-5 w-5 text-${colorClass}`} />
						<h3 className={`font-semibold text-${colorClass}`}>
							{hasIssues ? "System Health Issues" : "System Health Status"}
						</h3>
					</div>
					<div className={`mt-2 text-sm text-${colorClass}/80`}>
						{!systemHealth.database ? (
							<p>• Database connectivity issues detected</p>
						) : (
							<p>• Database is operational</p>
						)}
						{!systemHealth.storage ? (
							<p>• Storage service connectivity issues detected</p>
						) : (
							<p>• Storage service is operational</p>
						)}
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Active Tasks
							</CardTitle>
							<Activity className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-blue-600">
								{stats.activeSessions}
							</div>
							<p className="text-xs text-muted-foreground">Last 24 hours</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Users</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								{stats.totalUsers}
							</div>
							<p className="text-xs text-muted-foreground">Registered users</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
							<FileText className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-purple-600">
								{stats.totalTasks}
							</div>
							<p className="text-xs text-muted-foreground">Recording tasks</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Storage Used
							</CardTitle>
							<HardDrive className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-orange-600">
								{stats.storageUsed}
							</div>
							<p className="text-xs text-muted-foreground">Recording data</p>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
					{/* Session Management */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Activity className="h-5 w-5" />
								Session Management
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Link href="/dashboard/admin/sessions">
								<Button variant="outline" className="w-full justify-start">
									View All Active Sessions
								</Button>
							</Link>
						</CardContent>
					</Card>

					{/* User Management */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								User Management
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Link href="/dashboard/admin/users">
								<Button variant="outline" className="w-full justify-start">
									Manage All Users
								</Button>
							</Link>
						</CardContent>
					</Card>

					{/* Analytics & Reports */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5" />
								Analytics & Reports
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Link href="/dashboard/admin/audit">
								<Button variant="outline" className="w-full justify-start">
									Admin Audit Logs
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>

				{/* Recent Users - Now using data from stats API */}
				<Card className="mt-6">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UserCheck className="h-5 w-5" />
							Recent User Activity
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3 overflow-auto h-64">
							{stats.recentUsers.map((user) => (
								<div
									key={user.id}
									className="flex items-center justify-between p-3 bg-popover rounded-lg"
								>
									<div>
										<p className="font-medium">{user.fullName}</p>
										<p className="text-sm text-muted-foreground">
											{user.email}
										</p>
									</div>
									<div className="text-right">
										<Badge
											variant={user.role === "admin" ? "default" : "secondary"}
										>
											{user.role}
										</Badge>
										<p className="text-xs text-gray-500 mt-1">
											{new Date(user.created_at).toLocaleDateString()}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default AdminPage;
