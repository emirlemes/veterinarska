import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function ServicesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="services">{children}</ProtectedLayout>;
}
