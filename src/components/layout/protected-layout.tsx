import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/components/query-provider";
import { getPageSession } from "@/lib/auth/page-session";

export async function ProtectedLayout({
  children,
  section,
}: Readonly<{
  children: React.ReactNode;
  section: "dashboard" | "clients" | "animals" | "appointments" | "examinations" | "inventory" | "invoices" | "reports" | "inventory-report" | "services" | "employees" | "settings";
}>) {
  const session = await getPageSession();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.trim() || session.user.email || "Korisnik";

  return (
    <QueryProvider key={`${session.user.id}:${session.user.role}`}>
      <DashboardShell name={name} role={session.user.role} activeSection={section}>
        {children}
      </DashboardShell>
    </QueryProvider>
  );
}
