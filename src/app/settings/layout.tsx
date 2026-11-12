import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="settings">{children}</ProtectedLayout>;
}
