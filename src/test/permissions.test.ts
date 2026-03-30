import { describe, expect, it } from "vitest";
import { canAccessPath, canCreateKudos, createPermissionMap, getFallbackPermissionsForRole, getHomePath, hasModulePermission } from "@/lib/permissions";

describe("permission resolver", () => {
  it("allows every employee to access the wall of fame route", () => {
    const permissionMap = createPermissionMap(getFallbackPermissionsForRole("employee"));

    expect(canAccessPath(permissionMap, "/wall-of-fame")).toBe(true);
  });

  it("blocks admins from creating kudos under the special rule", () => {
    const permissionMap = createPermissionMap(getFallbackPermissionsForRole("admin"));

    expect(canCreateKudos(permissionMap)).toBe(false);
    expect(hasModulePermission(permissionMap, "kudos", "view")).toBe(true);
  });

  it("sends managers to the dashboard as their default safe route", () => {
    const permissionMap = createPermissionMap(getFallbackPermissionsForRole("manager"));

    expect(getHomePath(permissionMap)).toBe("/");
  });

  it("allows managers to view only their own payroll route", () => {
    const permissionMap = createPermissionMap(getFallbackPermissionsForRole("manager"));

    expect(canAccessPath(permissionMap, "/payroll")).toBe(true);
    expect(hasModulePermission(permissionMap, "payroll", "view")).toBe(true);
  });
});
