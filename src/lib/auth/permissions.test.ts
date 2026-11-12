import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, permissions } from "./permissions.ts";

test("admin has every application permission", () => {
  for (const permission of permissions) {
    assert.equal(hasPermission("ADMIN", permission), true, `ADMIN must have ${permission}`);
  }
});

test("veterinarian can perform all clinic operations", () => {
  const operationalPermissions = permissions.filter(
    (permission) => permission !== "employees:write" && permission !== "settings:write",
  );
  for (const permission of operationalPermissions) {
    assert.equal(
      hasPermission("VETERINARIAN", permission),
      true,
      `VETERINARIAN must have ${permission}`,
    );
  }
});

test("only admin can manage employee accounts and clinic settings", () => {
  assert.equal(hasPermission("ADMIN", "employees:write"), true);
  assert.equal(hasPermission("ADMIN", "settings:write"), true);
  assert.equal(hasPermission("VETERINARIAN", "employees:write"), false);
  assert.equal(hasPermission("VETERINARIAN", "settings:write"), false);
});
