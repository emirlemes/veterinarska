import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function AppointmentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="appointments">{children}</ProtectedLayout>;
}
