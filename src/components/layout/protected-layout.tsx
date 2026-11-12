import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export async function ProtectedLayout({
  children,
  section,
}: Readonly<{
  children: React.ReactNode;
  section: "dashboard" | "clients" | "animals" | "appointments" | "examinations" | "inventory" | "invoices" | "reports" | "inventory-report" | "services" | "employees" | "settings";
}>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name?.trim() || session.user.email || "Korisnik";

  return (
    <DashboardShell name={name} role={session.user.role} activeSection={section}>
      {children}
    </DashboardShell>
  );
}
