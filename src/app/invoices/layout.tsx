import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function InvoicesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="invoices">{children}</ProtectedLayout>;
}
