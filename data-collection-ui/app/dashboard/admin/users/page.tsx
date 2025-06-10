import React from "react";
import { requireAdmin } from "@/lib/auth";
import { UserManagement } from "@/components/admin/UserManagement";

const AdminUsersPage = async () => {
  // Ensure user is admin
  await requireAdmin();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      <div className="p-6">
        <UserManagement />
      </div>
    </div>
  );
};

export default AdminUsersPage;
