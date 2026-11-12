import { auth } from "@/auth";
import type { Permission } from "./permissions";
import { hasPermission } from "./permissions";

export async function authorizeApiRequest(permission: Permission) {
  const session = await auth();

  if (!session?.user) {
    return {
      user: null,
      response: Response.json({ error: "Potrebna je prijava." }, { status: 401 }),
    };
  }

  if (!hasPermission(session.user.role, permission)) {
    return {
      user: null,
      response: Response.json({ error: "Nemate pravo pristupa ovoj radnji." }, { status: 403 }),
    };
  }

  return { user: session.user, response: null };
}
