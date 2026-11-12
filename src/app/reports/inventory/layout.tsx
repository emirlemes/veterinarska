import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function InventoryReportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="inventory-report">{children}</ProtectedLayout>;
}
