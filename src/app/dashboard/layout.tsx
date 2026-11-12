import { ProtectedLayout } from "@/components/layout/protected-layout";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="dashboard">{children}</ProtectedLayout>;
}
