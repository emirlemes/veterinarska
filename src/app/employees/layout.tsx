import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function EmployeesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="employees">{children}</ProtectedLayout>;
}
