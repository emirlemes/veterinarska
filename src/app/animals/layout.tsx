import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function AnimalsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedLayout section="animals">{children}</ProtectedLayout>;
}
