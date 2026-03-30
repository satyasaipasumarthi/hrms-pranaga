import {
  defaultRolePermissions,
  moduleAccessDefinitions,
  navItemsByModule,
  routeConfigByPath,
  type AppModule,
  type AppRole,
  type DataScope,
  type ModuleAccessDefinition,
  type ModulePermission,
  type NavItem,
  type PermissionAction,
  type ResolvedModulePermission,
} from "./roles";

export type PermissionMap = Partial<Record<AppModule, ResolvedModulePermission>>;

export interface PermissionRowRecord {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
  data_scope: DataScope;
}

export interface ModuleAccessRowRecord {
  module: string;
  label: string;
  route_path: string | null;
  sort_order: number;
  is_enabled: boolean;
}

const actionToProperty: Record<PermissionAction, keyof ModulePermission> = {
  view: "canView",
  create: "canCreate",
  update: "canUpdate",
  delete: "canDelete",
  approve: "canApprove",
};

const dataScopeRank: Record<DataScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  organization: 3,
  all: 4,
};

const toResolvedPermission = (
  permission: ModulePermission,
  moduleAccessMap: Map<AppModule, ModuleAccessDefinition>,
): ResolvedModulePermission => {
  const moduleAccess = moduleAccessMap.get(permission.module) ?? {
    module: permission.module,
    label: permission.module,
    routePath: null,
    sortOrder: 999,
    isEnabled: true,
  };

  return {
    ...moduleAccess,
    ...permission,
  };
};

export const getFallbackPermissionsForRole = (role: AppRole): ResolvedModulePermission[] => {
  const moduleAccessMap = new Map(moduleAccessDefinitions.map((definition) => [definition.module, definition]));
  return defaultRolePermissions[role]
    .map((permission) => toResolvedPermission(permission, moduleAccessMap))
    .sort((left, right) => left.sortOrder - right.sortOrder);
};

export const resolvePermissionRows = (
  role: AppRole,
  permissionRows?: PermissionRowRecord[] | null,
  moduleRows?: ModuleAccessRowRecord[] | null,
): ResolvedModulePermission[] => {
  if (!permissionRows?.length) {
    return getFallbackPermissionsForRole(role);
  }

  const moduleAccessRows = moduleRows?.length
    ? moduleRows
        .filter((row) => row.is_enabled)
        .map<ModuleAccessDefinition>((row) => ({
          module: row.module as AppModule,
          label: row.label,
          routePath: row.route_path,
          sortOrder: row.sort_order,
          isEnabled: row.is_enabled,
        }))
    : moduleAccessDefinitions;

  const moduleAccessMap = new Map(moduleAccessRows.map((definition) => [definition.module, definition]));

  return permissionRows
    .map<ResolvedModulePermission>((row) =>
      toResolvedPermission(
        {
          module: row.module as AppModule,
          canView: row.can_view,
          canCreate: row.can_create,
          canUpdate: row.can_update,
          canDelete: row.can_delete,
          canApprove: row.can_approve,
          dataScope: row.data_scope,
        },
        moduleAccessMap,
      ),
    )
    .filter((permission) => permission.isEnabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
};

export const createPermissionMap = (permissions: ResolvedModulePermission[]): PermissionMap =>
  permissions.reduce<PermissionMap>((accumulator, permission) => {
    accumulator[permission.module] = permission;
    return accumulator;
  }, {});

export const getModulePermission = (permissionMap: PermissionMap, module: AppModule): ResolvedModulePermission => {
  return (
    permissionMap[module] ?? {
      module,
      label: module,
      routePath: null,
      sortOrder: 999,
      isEnabled: false,
      canView: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canApprove: false,
      dataScope: "none",
    }
  );
};

export const hasModulePermission = (
  permissionMap: PermissionMap,
  module: AppModule,
  action: PermissionAction = "view",
) => {
  const permission = getModulePermission(permissionMap, module);
  return Boolean(permission[actionToProperty[action]]);
};

export const hasMinimumDataScope = (
  permissionMap: PermissionMap,
  module: AppModule,
  minimumScope: DataScope,
) => {
  const permission = getModulePermission(permissionMap, module);
  return dataScopeRank[permission.dataScope] >= dataScopeRank[minimumScope];
};

export const getAccessibleNavItems = (permissionMap: PermissionMap): NavItem[] =>
  moduleAccessDefinitions
    .filter((definition) => definition.routePath && hasModulePermission(permissionMap, definition.module, "view"))
    .map((definition) => navItemsByModule[definition.module as Exclude<AppModule, "kudos">])
    .filter(Boolean)
    .sort((left, right) => {
      const leftOrder = moduleAccessDefinitions.find((definition) => definition.module === left.module)?.sortOrder ?? 999;
      const rightOrder = moduleAccessDefinitions.find((definition) => definition.module === right.module)?.sortOrder ?? 999;
      return leftOrder - rightOrder;
    });

export const getHomePath = (permissionMap: PermissionMap) =>
  getAccessibleNavItems(permissionMap)[0]?.path ?? "/login";

export const canAccessPath = (permissionMap: PermissionMap, path: string) => {
  const route = routeConfigByPath[path];
  if (!route) {
    return false;
  }

  return hasModulePermission(permissionMap, route.module, "view");
};

export const canCreateKudos = (permissionMap: PermissionMap) => hasModulePermission(permissionMap, "kudos", "create");

export const canManageEmployees = (permissionMap: PermissionMap) =>
  hasModulePermission(permissionMap, "employees", "view");

export const canViewAllAttendance = (permissionMap: PermissionMap) =>
  hasMinimumDataScope(permissionMap, "attendance", "organization");

export const canViewTeamAttendance = (permissionMap: PermissionMap) =>
  hasMinimumDataScope(permissionMap, "attendance", "team");

export const canManageSettings = (permissionMap: PermissionMap) =>
  hasModulePermission(permissionMap, "settings", "view");
