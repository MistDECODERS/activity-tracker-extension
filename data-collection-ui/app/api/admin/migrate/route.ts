import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }    const supabase = await createClient();

    // Run the user roles migration
    const userRolesMigrationSQL = `
      -- Migration: Add role field to user_profiles and set default roles
      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
              ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
          END IF;
      END $$;

      -- Update any existing users without a role to have 'user' role
      UPDATE user_profiles 
      SET role = 'user' 
      WHERE role IS NULL OR role = '';

      -- Ensure the role column has a NOT NULL constraint
      ALTER TABLE user_profiles ALTER COLUMN role SET NOT NULL;

      -- Add a check constraint to ensure only valid roles are used
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                         WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_role_check') THEN
              ALTER TABLE user_profiles 
              ADD CONSTRAINT user_profiles_role_check 
              CHECK (role IN ('user', 'admin'));
          END IF;
      END $$;

      -- Create an index on the role column for better query performance
      CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
    `;

    // Run the audit logs migration
    const auditLogsMigrationSQL = `
      -- Create audit_logs table for tracking admin actions
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        admin_user_id UUID NOT NULL,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('user', 'session', 'system')),
        target_id TEXT,
        details JSONB DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

      -- Add RLS (Row Level Security) policies
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    `;

    try {
      // Execute user roles migration
      const { error: userRolesError } = await supabase.rpc('exec_sql', {
        sql: userRolesMigrationSQL
      });

      if (userRolesError) {
        console.error("User roles migration error:", userRolesError);
        return NextResponse.json(
          { error: "Failed to run user roles migration", details: userRolesError.message },
          { status: 500 }
        );
      }

      // Execute audit logs migration
      const { error: auditLogsError } = await supabase.rpc('exec_sql', {
        sql: auditLogsMigrationSQL
      });

      if (auditLogsError) {
        console.error("Audit logs migration error:", auditLogsError);
        // Don't fail completely if audit logs migration fails
        console.warn("Audit logs migration failed, continuing...");
      }
    } catch (migrationError) {
      console.error("Migration execution error:", migrationError);
      return NextResponse.json(
        { error: "Failed to execute migrations" },
        { status: 500 }
      );
    }

    // Verify the migration by checking if all users have roles
    const { data: users, error: usersError } = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .is("role", null);

    if (usersError) {
      console.error("Error checking migration:", usersError);
      return NextResponse.json(
        { error: "Migration completed but verification failed" },
        { status: 500 }
      );
    }

    const usersWithoutRoles = users?.length || 0;

    return NextResponse.json({
      success: true,
      message: "User roles migration completed successfully",
      usersWithoutRoles,
      migrationComplete: usersWithoutRoles === 0
    });

  } catch (error) {
    console.error("Error running migration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
