import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function InventoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="inventory">{children}</ProtectedLayout>;
}
