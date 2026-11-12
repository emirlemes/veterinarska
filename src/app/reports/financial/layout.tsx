import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function FinancialReportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="reports">{children}</ProtectedLayout>;
}
