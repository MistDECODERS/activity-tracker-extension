"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/shared/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { taskCategories } from "@/lib/task-data";
import { useTaskStatus } from "@/contexts/task-status-context";
import {
  CheckCircle,
  Clock,
  ArrowRight,
  FileWarning,
  Loader2,
  ListTodo,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Dashboard() {
  const { taskStatuses, resetAllStatuses, isLoading, isResetting } =
    useTaskStatus();
  const [mounted, setMounted] = useState(false);
  const supbase = createClient();
  const [user, setUser] = useState<User | null>(null);

  // Ensure we only render after hydration to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const { data } = await supbase.auth.getUser();
      setUser(data.user);
    };
    fetchUser();
  }, [supbase]);

  // Calculate statistics
  const totalTasks = taskCategories.reduce(
    (acc, category) => acc + category.tasks.length,
    0
  );

  const completedTasks = Object.values(taskStatuses).filter(
    (status) => status === "completed"
  ).length;

  const inProgressTasks = Object.values(taskStatuses).filter(
    (status) => status === "in-progress"
  ).length;

  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate category statistics
  const categoryStats = taskCategories.map((category) => {
    const totalCategoryTasks = category.tasks.length;

    const completedCategoryTasks = category.tasks.filter(
      (task) => taskStatuses[task.id] === "completed"
    ).length;

    const inProgressCategoryTasks = category.tasks.filter(
      (task) => taskStatuses[task.id] === "in-progress"
    ).length;

    const completionPercentage =
      totalCategoryTasks > 0
        ? Math.round((completedCategoryTasks / totalCategoryTasks) * 100)
        : 0;

    return {
      id: category.id,
      name: category.name,
      total: totalCategoryTasks,
      completed: completedCategoryTasks,
      inProgress: inProgressCategoryTasks,
      percentage: completionPercentage,
    };
  });

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <>
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <header className="border-b border-border/40 bg-card backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex h-14 items-center px-4 lg:px-8">
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <div className="ml-auto flex items-center gap-4">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllStatuses}
                disabled={isLoading || isResetting}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Progress"
                )}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {user && (
            <h2 className="text-xl font-semibold mb-5">
              Welcome back,{" "}
              <span className="text-chart-5">
                {user.user_metadata.fullName}
              </span>
              !
            </h2>
          )}
          <Alert className="mb-6 bg-warning">
            <FileWarning className="h-4 w-4" color="red" />
            <AlertDescription className="text-foreground font-bold">
              Your progress is now stored in your account. Sign in on any device
              to access your data.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading your progress...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="hover:border-chart-1">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                      Total Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-3xl font-bold">{totalTasks}</div>
                    <ListTodo className="h-10 w-10 text-chart-1" />
                  </CardContent>
                </Card>

                <Card className="hover:border-chart-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                      Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-foreground">
                      {completedTasks}
                    </div>
                    <CheckCircle className="h-10 w-10 text-chart-2" />
                  </CardContent>
                </Card>

                <Card className="hover:border-chart-3">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                      In Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-foreground">
                      {inProgressTasks}
                    </div>
                    <Clock className="h-10 w-10 text-chart-3" />
                  </CardContent>
                </Card>

                <Card className="hover:border-chart-4">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                      Completion Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-3xl font-bold">
                      {completionPercentage}%
                    </div>
                    <Target className="h-10 w-10 text-chart-4" />
                  </CardContent>
                </Card>
              </div>

              {/* Bento Grid for Category Stats */}
              <h2 className="text-lg font-medium mb-4">Category Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryStats.map((category) => (
                  <Card
                    key={category.id}
                    className={
                      category.percentage === 100
                        ? "border-green-500/30"
                        : category.percentage >= 50
                        ? "border-warning/50 bg-warning/20"
                        : "border-destructive/20"
                    }
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium flex justify-between">
                        {category.name}
                        <span className="text-sm font-normal text-muted-foreground">
                          {category.completed}/{category.total} tasks
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Completed: {category.completed}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span>In Progress: {category.inProgress}</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${category.percentage}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium">
                            {category.percentage}% complete
                          </div>
                          <Link
                            href={`/dashboard/tasks?category=${category.id}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                            >
                              <span>View Tasks</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
