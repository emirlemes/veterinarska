import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Permission } from "./permissions";
import { hasPermission } from "./permissions";

export async function requirePermission(permission: Permission) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, permission)) {
    redirect("/dashboard?greska=nedozvoljen-pristup");
  }

  return session.user;
}
