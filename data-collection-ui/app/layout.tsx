import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "sonner";
import DeviceDetector from "@/lib/use-device";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "ScreenTrail - Task Dashboard",
	description: "Track your digital journey with ScreenTrail",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem={true}
				>
					<DeviceDetector>
						<div className="flex h-screen bg-background">{children}</div>
					</DeviceDetector>
					<Toaster richColors position="top-right" />
				</ThemeProvider>
			</body>
		</html>
	);
}
