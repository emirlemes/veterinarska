import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function ExaminationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="examinations">{children}</ProtectedLayout>;
}
