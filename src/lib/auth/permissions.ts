import type { Role } from "@prisma/client";

export const permissions = [
  "dashboard:read",
  "clients:read",
  "clients:write",
  "animals:read",
  "animals:write",
  "appointments:read",
  "appointments:write",
  "examinations:read",
  "examinations:write",
  "therapies:write",
  "medications:read",
  "inventory:write",
  "services:read",
  "services:write",
  "invoices:read",
  "invoices:write",
  "payments:write",
  "reports:financial",
  "reports:inventory",
  "employees:write",
  "settings:write",
] as const;

export type Permission = (typeof permissions)[number];

const allPermissions = new Set<Permission>(permissions);

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: allPermissions,
  VETERINARIAN: new Set(permissions.filter(
    (permission) => permission !== "employees:write" && permission !== "settings:write",
  )),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}
