import {
  CalendarOff,
  Clock,
  DollarSign,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Trophy,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "admin" | "hr" | "manager" | "employee";

export type AppModule =
  | "dashboard"
  | "team"
  | "attendance"
  | "leave"
  | "payroll"
  | "performance"
  | "employees"
  | "recruitment"
  | "access_control"
  | "wall_of_fame"
  | "settings"
  | "kudos";

export type PermissionAction = "view" | "create" | "update" | "delete" | "approve";

export type DataScope = "none" | "own" | "team" | "organization" | "all";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  module: AppModule;
}

export interface ModulePermission {
  module: AppModule;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  dataScope: DataScope;
}

export interface ModuleAccessDefinition {
  module: AppModule;
  label: string;
  routePath: string | null;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ResolvedModulePermission extends ModulePermission, ModuleAccessDefinition {}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  department: string | null;
  managerId: string | null;
}

export interface Kudos {
  id: string;
  from: string;
  fromRole: AppRole;
  to: string;
  message: string;
  date: string;
}

const grant = (
  module: AppModule,
  options: Partial<Omit<ModulePermission, "module">> & { dataScope: DataScope },
): ModulePermission => ({
  module,
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
  ...options,
});

export const moduleAccessDefinitions: ModuleAccessDefinition[] = [
  { module: "dashboard", label: "Dashboard", routePath: "/", sortOrder: 10, isEnabled: true },
  { module: "team", label: "Team", routePath: "/team", sortOrder: 20, isEnabled: true },
  { module: "attendance", label: "Attendance", routePath: "/attendance", sortOrder: 30, isEnabled: true },
  { module: "leave", label: "Leave", routePath: "/leave", sortOrder: 40, isEnabled: true },
  { module: "payroll", label: "Payroll", routePath: "/payroll", sortOrder: 50, isEnabled: true },
  { module: "performance", label: "Performance", routePath: "/performance", sortOrder: 60, isEnabled: true },
  { module: "employees", label: "Employees", routePath: "/employees", sortOrder: 70, isEnabled: true },
  { module: "recruitment", label: "Recruitment", routePath: "/recruitment", sortOrder: 80, isEnabled: true },
  { module: "wall_of_fame", label: "Wall of Fame", routePath: "/wall-of-fame", sortOrder: 90, isEnabled: true },
  { module: "access_control", label: "Access Control", routePath: "/access-control", sortOrder: 95, isEnabled: true },
  { module: "settings", label: "Settings", routePath: "/settings", sortOrder: 100, isEnabled: true },
  { module: "kudos", label: "Kudos", routePath: null, sortOrder: 110, isEnabled: true },
];

export const navItemsByModule: Record<Exclude<AppModule, "kudos">, NavItem> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard, path: "/", module: "dashboard" },
  team: { label: "Team", icon: UsersRound, path: "/team", module: "team" },
  attendance: { label: "Attendance", icon: Clock, path: "/attendance", module: "attendance" },
  leave: { label: "Leave", icon: CalendarOff, path: "/leave", module: "leave" },
  payroll: { label: "Payroll", icon: DollarSign, path: "/payroll", module: "payroll" },
  performance: { label: "Performance", icon: TrendingUp, path: "/performance", module: "performance" },
  employees: { label: "Employees", icon: Users, path: "/employees", module: "employees" },
  recruitment: { label: "Recruitment", icon: UserPlus, path: "/recruitment", module: "recruitment" },
  access_control: { label: "Access Control", icon: ShieldCheck, path: "/access-control", module: "access_control" },
  wall_of_fame: { label: "Wall of Fame", icon: Trophy, path: "/wall-of-fame", module: "wall_of_fame" },
  settings: { label: "Settings", icon: Settings, path: "/settings", module: "settings" },
};

export const routeConfig = Object.values(navItemsByModule);

export const routeConfigByPath = routeConfig.reduce<Record<string, NavItem>>((accumulator, item) => {
  accumulator[item.path] = item;
  return accumulator;
}, {});

export const defaultRolePermissions: Record<AppRole, ModulePermission[]> = {
  employee: [
    grant("dashboard", { canView: true, dataScope: "own" }),
    grant("attendance", { canView: true, canCreate: true, canUpdate: true, dataScope: "own" }),
    grant("leave", { canView: true, canCreate: true, dataScope: "own" }),
    grant("payroll", { canView: true, dataScope: "own" }),
    grant("performance", { canView: true, dataScope: "own" }),
    grant("wall_of_fame", { canView: true, dataScope: "organization" }),
    grant("kudos", { canView: true, dataScope: "own" }),
  ],
  manager: [
    grant("dashboard", { canView: true, dataScope: "team" }),
    grant("team", { canView: true, dataScope: "team" }),
    grant("attendance", { canView: true, canCreate: true, canUpdate: true, dataScope: "team" }),
    grant("leave", { canView: true, canCreate: true, canUpdate: true, canApprove: true, dataScope: "team" }),
    grant("payroll", { canView: true, dataScope: "own" }),
    grant("performance", { canView: true, canUpdate: true, dataScope: "team" }),
    grant("wall_of_fame", { canView: true, dataScope: "organization" }),
    grant("kudos", { canView: true, canCreate: true, dataScope: "team" }),
  ],
  hr: [
    grant("dashboard", { canView: true, dataScope: "organization" }),
    grant("attendance", { canView: true, canCreate: true, canUpdate: true, dataScope: "organization" }),
    grant("leave", { canView: true, canUpdate: true, canApprove: true, dataScope: "organization" }),
    grant("payroll", { canView: true, canUpdate: true, dataScope: "organization" }),
    grant("performance", { canView: true, canUpdate: true, dataScope: "organization" }),
    grant("employees", { canView: true, canUpdate: true, dataScope: "organization" }),
    grant("recruitment", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "organization" }),
    grant("wall_of_fame", { canView: true, dataScope: "organization" }),
    grant("kudos", { canView: true, canCreate: true, dataScope: "organization" }),
  ],
  admin: [
    grant("dashboard", { canView: true, dataScope: "all" }),
    grant("team", { canView: true, dataScope: "all" }),
    grant("attendance", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("leave", { canView: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true, dataScope: "all" }),
    grant("payroll", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("performance", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("employees", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("recruitment", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("access_control", { canView: true, canCreate: true, canUpdate: true, dataScope: "all" }),
    grant("wall_of_fame", { canView: true, dataScope: "all" }),
    grant("settings", { canView: true, canCreate: true, canUpdate: true, canDelete: true, dataScope: "all" }),
    grant("kudos", { canView: true, dataScope: "all" }),
  ],
};

export const appRoles: AppRole[] = ["admin", "hr", "manager", "employee"];
export const assignableRoles = ["hr", "manager", "employee"] as const;
export type AssignableRole = (typeof assignableRoles)[number];

export const formatRoleLabel = (role: AppRole) => role.charAt(0).toUpperCase() + role.slice(1);

export const normalizeRole = (role: string | null | undefined): AppRole | null => {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toLowerCase();
  return appRoles.includes(normalized as AppRole) ? (normalized as AppRole) : null;
};
