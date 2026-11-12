import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function ClientsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="clients">{children}</ProtectedLayout>;
}
