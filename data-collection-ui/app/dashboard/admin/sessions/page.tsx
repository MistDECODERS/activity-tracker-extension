import React from "react";
import { ensureAdmin } from "@/lib/auth";
import { RecordingSessionManagement } from "@/components/admin/RecordingSessionManagement";

const AdminSessionsPage = async () => {
	// Ensure user is admin
	await ensureAdmin();

	return (
		<div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
			<div className="p-6">
				<RecordingSessionManagement />
			</div>
		</div>
	);
};

export default AdminSessionsPage;
