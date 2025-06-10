import { Sidebar } from "@/components/shared/sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  
  if (error || !data?.user) {
    redirect("/auth");
  }

  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}
