import type { PostgrestError } from "@supabase/supabase-js";
import {
  calculateAttendanceStatus,
  calculateDurationMinutes,
  formatWorkedDuration,
  getBusinessDateKey,
  getBusinessDateRange,
  parseAttendanceDateValue,
} from "@/lib/attendance";
import { createPermissionMap, getModulePermission, resolvePermissionRows, type ModuleAccessRowRecord, type PermissionMap, type PermissionRowRecord } from "@/lib/permissions";
import { normalizeRole, type AppModule, type AssignableRole, type AuthUser, type DataScope, type ResolvedModulePermission } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

export interface AccessContextResult {
  user: AuthUser;
  permissions: ResolvedModulePermission[];
  permissionMap: PermissionMap;
  usedFallbackPermissions: boolean;
}

export class AccessContextError extends Error {
  code: "profile_missing" | "role_invalid";

  constructor(code: "profile_missing" | "role_invalid", message: string) {
    super(message);
    this.code = code;
    this.name = "AccessContextError";
  }
}

export interface ProfileRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  manager_id: string | null;
  reporting_manager_id: string | null;
  reporting_manager_name: string | null;
}

export interface ManagerOption {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
}

export interface AccessGrantRecord {
  id: string;
  name: string;
  email: string;
  role: AssignableRole;
  department: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  grantedById: string | null;
  grantedByName: string | null;
  inviteCount: number;
  lastInvitedAt: string;
  authUserId: string | null;
}

export interface AccessInvitePayload {
  name: string;
  email: string;
  role: AssignableRole;
  department: string;
  reportingManagerId?: string | null;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  employeeName: string;
  department: string | null;
  date: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  checkIn: string | null;
  checkOut: string | null;
  totalMinutes: number;
  totalHours: string;
  status: string;
  isPaused: boolean;
  pauseStartIso: string | null;
  totalPausedDurationSeconds: number;
}

type AttendanceSchemaMode = "current" | "legacy";

type ProfileFilter =
  | {
      type: "eq";
      column: "id" | "manager_id" | "department";
      value: string;
    }
  | {
      type: "in";
      column: "id";
      value: string[];
    };

export interface LeaveRecord {
  id: string;
  userId: string;
  employeeName: string;
  type: string;
  from: string;
  to: string;
  status: string;
  days: number;
  reason: string | null;
  approverId: string | null;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  employeeName: string;
  month: string;
  gross: number;
  deductions: number;
  net: number;
  payslipUrl: string | null;
}

export interface PerformanceRecord {
  id: string;
  userId: string;
  employeeName: string;
  objective: string;
  progress: number;
  summary: string;
  reviewerName: string;
  createdAt: string;
}

export interface RecruitmentCandidateRecord {
  id: string;
  name: string;
  position: string;
  stage: string;
}

export interface KudosRecord {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  fromName: string;
  toName: string;
  fromRole: string;
  message: string;
  createdAt: string;
}

const PROFILE_SELECT_WITH_MANAGER =
  "id, name, email, role, department, manager_id, reporting_manager_id, reporting_manager:reporting_managers(name)";
const PROFILE_SELECT_FALLBACK = "id, name, email, role, department";

const scopeRank: Record<DataScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  organization: 3,
  all: 4,
};

const isMissingResourceError = (error: PostgrestError | null | undefined) => {
  if (!error) {
    return false;
  }

  const haystack = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    haystack.includes("does not exist") ||
    haystack.includes("could not find the table") ||
    haystack.includes("could not find the function") ||
    haystack.includes("could not find") ||
    haystack.includes("schema cache") ||
    haystack.includes("column") ||
    haystack.includes("relation") ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204"
  );
};

const isNoRowsError = (error: PostgrestError | null | undefined) => {
  if (!error) {
    return false;
  }

  return error.code === "PGRST116" || error.message.toLowerCase().includes("no rows");
};

const formatTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  return parseAttendanceDateValue(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getParsedTimestamp = (value: string | null) => {
  if (!value) {
    return null;
  }

  const timestamp = parseAttendanceDateValue(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return getBusinessDateKey();
  }

  return getBusinessDateKey(value);
};

const getTodayDateKey = () => getBusinessDateKey();

const getDayAlreadyRecordedMessage = () =>
  "Today's attendance has already been recorded. A new entry can be created tomorrow.";

const getPauseFieldsMissingMessage = () =>
  "Pause / Resume needs the new attendance pause fields in Supabase. Run `supabase/attendance-pause-fields.sql` first.";

const CURRENT_ATTENDANCE_BASE_SELECT = "id, user_id, date, check_in, check_out, status, created_at";
const CURRENT_ATTENDANCE_PAUSE_SELECT = `${CURRENT_ATTENDANCE_BASE_SELECT}, is_paused, pause_start_time, total_paused_duration`;
const LEGACY_ATTENDANCE_BASE_SELECT =
  "id, user_id, login_time, logout_time, duration_minutes, shift_minutes, attendance_status, created_at";
const LEGACY_ATTENDANCE_PAUSE_SELECT =
  `${LEGACY_ATTENDANCE_BASE_SELECT}, is_paused, pause_start_time, total_paused_duration`;

const closeStaleCurrentAttendanceRows = async (userId: string, date: string) => {
  const staleRowsResponse = await supabase
    .from("attendance")
    .select("id, check_in")
    .eq("user_id", userId)
    .is("check_out", null)
    .lt("date", date);

  if (staleRowsResponse.error) {
    if (isNoRowsError(staleRowsResponse.error) || isMissingResourceError(staleRowsResponse.error)) {
      return false;
    }

    throw staleRowsResponse.error;
  }

  for (const row of staleRowsResponse.data ?? []) {
    const staleCheckIn = row.check_in ? String(row.check_in) : new Date().toISOString();
    const closeResponse = await supabase
      .from("attendance")
      .update({
        check_out: staleCheckIn,
        status: "Absent",
      })
      .eq("id", String(row.id))
      .eq("user_id", userId);

    if (closeResponse.error) {
      throw closeResponse.error;
    }
  }

  return (staleRowsResponse.data?.length ?? 0) > 0;
};

const closeStaleLegacyAttendanceRows = async (userId: string, startIso: string) => {
  const staleRowsResponse = await supabase
    .from("attendance")
    .select("id, login_time")
    .eq("user_id", userId)
    .is("logout_time", null)
    .lt("login_time", startIso);

  if (staleRowsResponse.error) {
    if (isNoRowsError(staleRowsResponse.error) || isMissingResourceError(staleRowsResponse.error)) {
      return false;
    }

    throw staleRowsResponse.error;
  }

  for (const row of staleRowsResponse.data ?? []) {
    const staleLoginTime = row.login_time ? String(row.login_time) : new Date().toISOString();
    const closeResponse = await supabase
      .from("attendance")
      .update({
        logout_time: staleLoginTime,
        duration_minutes: 0,
        attendance_status: "Absent",
      })
      .eq("id", String(row.id))
      .eq("user_id", userId);

    if (closeResponse.error) {
      throw closeResponse.error;
    }
  }

  return (staleRowsResponse.data?.length ?? 0) > 0;
};

type AggregatedAttendanceRow = {
  id: string;
  userId: string;
  date: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  totalMinutes: number;
  status: string;
  isPaused: boolean;
  pauseStartIso: string | null;
  totalPausedDurationSeconds: number;
};

type AttendancePauseMetadata = {
  isPaused: boolean;
  pauseStartIso: string | null;
  totalPausedDurationSeconds: number;
};

const getPauseMetadata = (row: Record<string, unknown>): AttendancePauseMetadata => ({
  isPaused: Boolean(row.is_paused),
  pauseStartIso: row.pause_start_time ? String(row.pause_start_time) : null,
  totalPausedDurationSeconds: Math.max(Number(row.total_paused_duration ?? 0), 0),
});

const withDefaultPauseMetadata = (rows: Array<Record<string, unknown>>) =>
  rows.map((row) => ({
    ...row,
    is_paused: row.is_paused ?? false,
    pause_start_time: row.pause_start_time ?? null,
    total_paused_duration: row.total_paused_duration ?? 0,
  }));

const getOngoingPauseDurationSeconds = (pauseStartIso: string | null, nowValue: string | Date) => {
  if (!pauseStartIso) {
    return 0;
  }

  const pauseStartTime = getParsedTimestamp(pauseStartIso);
  const nowTimestamp =
    nowValue instanceof Date ? nowValue.getTime() : getParsedTimestamp(nowValue);

  if (pauseStartTime === null || nowTimestamp === null) {
    return 0;
  }

  return Math.max(Math.round((nowTimestamp - pauseStartTime) / 1000), 0);
};

const getEffectivePausedDurationSeconds = (
  pauseMetadata: AttendancePauseMetadata,
  nowValue?: string | Date,
) => {
  const baseDuration = Math.max(Math.round(pauseMetadata.totalPausedDurationSeconds), 0);
  if (!pauseMetadata.isPaused || !pauseMetadata.pauseStartIso || !nowValue) {
    return baseDuration;
  }

  return baseDuration + getOngoingPauseDurationSeconds(pauseMetadata.pauseStartIso, nowValue);
};

const getEarlierIso = (left: string | null, right: string | null) => {
  if (left && right) {
    return (getParsedTimestamp(left) ?? Number.POSITIVE_INFINITY) <= (getParsedTimestamp(right) ?? Number.POSITIVE_INFINITY) ? left : right;
  }

  return left ?? right;
};

const getLaterIso = (left: string | null, right: string | null) => {
  if (left && right) {
    return (getParsedTimestamp(left) ?? Number.NEGATIVE_INFINITY) >= (getParsedTimestamp(right) ?? Number.NEGATIVE_INFINITY) ? left : right;
  }

  return left ?? right;
};

const getPreferredAttendanceId = (
  existing: { id: string; createdAt: string | null },
  next: { id: string; createdAt: string | null },
) => {
  if (!existing.createdAt || !next.createdAt) {
    return existing.createdAt ? existing.id : next.id;
  }

  return (getParsedTimestamp(existing.createdAt) ?? Number.POSITIVE_INFINITY) <=
    (getParsedTimestamp(next.createdAt) ?? Number.POSITIVE_INFINITY)
    ? existing.id
    : next.id;
};

const getDifferenceBasedAttendance = ({
  id,
  userId,
  date,
  checkInIso,
  checkOutIso,
  createdAt,
  pauseMetadata,
}: {
  id: string;
  userId: string;
  date: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  createdAt: string | null;
  pauseMetadata: AttendancePauseMetadata;
}) => {
  const hasOpenShift = Boolean(checkInIso && !checkOutIso);
  const totalMinutes = hasOpenShift
    ? 0
    : calculateDurationMinutes(checkInIso, checkOutIso, {
        pausedDurationSeconds: pauseMetadata.totalPausedDurationSeconds,
      });

  return {
    id,
    userId,
    date,
    checkInIso,
    checkOutIso,
    totalMinutes,
    status: calculateAttendanceStatus(totalMinutes, { isOpenShift: hasOpenShift }),
    createdAt,
    isOpenShift: hasOpenShift,
    isPaused: hasOpenShift ? pauseMetadata.isPaused : false,
    pauseStartIso: hasOpenShift ? pauseMetadata.pauseStartIso : null,
    totalPausedDurationSeconds: pauseMetadata.totalPausedDurationSeconds,
  };
};

const aggregateCurrentAttendanceRows = (rows: Array<Record<string, unknown>>): AggregatedAttendanceRow[] => {
  const groupedRows = new Map<
    string,
    AggregatedAttendanceRow & { createdAt: string | null; isOpenShift: boolean }
  >();

  rows.forEach((row) => {
    const userId = String(row.user_id);
    const date = String(row.date);
    const checkInIso = row.check_in ? String(row.check_in) : null;
    const checkOutIso = row.check_out ? String(row.check_out) : null;
    const pauseMetadata = getPauseMetadata(row);
    const key = `${userId}:${date}`;
    const existing = groupedRows.get(key);
    const createdAt = row.created_at ? String(row.created_at) : null;

    if (!existing) {
      groupedRows.set(
        key,
        getDifferenceBasedAttendance({
          id: String(row.id),
          userId,
          date,
          checkInIso,
          checkOutIso,
          createdAt,
          pauseMetadata,
        }),
      );
      return;
    }

    const mergedCheckIn = getEarlierIso(existing.checkInIso, checkInIso);
    const mergedCheckOut = existing.isOpenShift || Boolean(checkInIso && !checkOutIso) ? null : getLaterIso(existing.checkOutIso, checkOutIso);
    const mergedPauseMetadata: AttendancePauseMetadata = {
      isPaused: existing.isPaused || pauseMetadata.isPaused,
      pauseStartIso: pauseMetadata.isPaused ? pauseMetadata.pauseStartIso : existing.pauseStartIso,
      totalPausedDurationSeconds:
        Math.max(Math.round(existing.totalPausedDurationSeconds), 0) +
        Math.max(Math.round(pauseMetadata.totalPausedDurationSeconds), 0),
    };

    groupedRows.set(
      key,
      getDifferenceBasedAttendance({
        id: getPreferredAttendanceId(existing, { id: String(row.id), createdAt }),
        userId,
        date,
        checkInIso: mergedCheckIn,
        checkOutIso: mergedCheckOut,
        createdAt: existing.createdAt && createdAt
          ? ((getParsedTimestamp(existing.createdAt) ?? Number.POSITIVE_INFINITY) <=
            (getParsedTimestamp(createdAt) ?? Number.POSITIVE_INFINITY)
              ? existing.createdAt
              : createdAt)
          : existing.createdAt ?? createdAt,
        pauseMetadata: mergedPauseMetadata,
      }),
    );
  });

  return Array.from(groupedRows.values())
    .map(({ createdAt: _createdAt, isOpenShift: _isOpenShift, ...attendance }) => attendance)
    .sort((left, right) => {
      const leftTime = getParsedTimestamp(left.checkInIso) ?? 0;
      const rightTime = getParsedTimestamp(right.checkInIso) ?? 0;
      return rightTime - leftTime;
    });
};

const aggregateLegacyAttendanceRows = (rows: Array<Record<string, unknown>>): AggregatedAttendanceRow[] => {
  const groupedRows = new Map<
    string,
    AggregatedAttendanceRow & { createdAt: string | null; isOpenShift: boolean }
  >();

  rows.forEach((row) => {
    const userId = String(row.user_id);
    const loginTime = row.login_time ? String(row.login_time) : null;
    const logoutTime = row.logout_time ? String(row.logout_time) : null;
    const pauseMetadata = getPauseMetadata(row);
    const date = getBusinessDateKey(loginTime ?? (row.created_at ? String(row.created_at) : new Date()));
    const key = `${userId}:${date}`;
    const existing = groupedRows.get(key);
    const createdAt = row.created_at ? String(row.created_at) : null;

    if (!existing) {
      groupedRows.set(
        key,
        getDifferenceBasedAttendance({
          id: String(row.id),
          userId,
          date,
          checkInIso: loginTime,
          checkOutIso: logoutTime,
          createdAt,
          pauseMetadata,
        }),
      );
      return;
    }

    const mergedCheckIn = getEarlierIso(existing.checkInIso, loginTime);
    const mergedCheckOut = existing.isOpenShift || Boolean(loginTime && !logoutTime) ? null : getLaterIso(existing.checkOutIso, logoutTime);
    const mergedPauseMetadata: AttendancePauseMetadata = {
      isPaused: existing.isPaused || pauseMetadata.isPaused,
      pauseStartIso: pauseMetadata.isPaused ? pauseMetadata.pauseStartIso : existing.pauseStartIso,
      totalPausedDurationSeconds:
        Math.max(Math.round(existing.totalPausedDurationSeconds), 0) +
        Math.max(Math.round(pauseMetadata.totalPausedDurationSeconds), 0),
    };

    groupedRows.set(
      key,
      getDifferenceBasedAttendance({
        id: getPreferredAttendanceId(existing, { id: String(row.id), createdAt }),
        userId,
        date,
        checkInIso: mergedCheckIn,
        checkOutIso: mergedCheckOut,
        createdAt: existing.createdAt && createdAt
          ? ((getParsedTimestamp(existing.createdAt) ?? Number.POSITIVE_INFINITY) <=
            (getParsedTimestamp(createdAt) ?? Number.POSITIVE_INFINITY)
              ? existing.createdAt
              : createdAt)
          : existing.createdAt ?? createdAt,
        pauseMetadata: mergedPauseMetadata,
      }),
    );
  });

  return Array.from(groupedRows.values())
    .map(({ createdAt: _createdAt, isOpenShift: _isOpenShift, ...attendance }) => attendance)
    .sort((left, right) => {
      const leftTime = getParsedTimestamp(left.checkInIso) ?? 0;
      const rightTime = getParsedTimestamp(right.checkInIso) ?? 0;
      return rightTime - leftTime;
    });
};

export const getReadableErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message = errorRecord.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    const details = errorRecord.details;
    if (typeof details === "string" && details.trim()) {
      return details;
    }
  }

  return fallbackMessage;
};

const getFunctionInvokeErrorMessage = async (error: unknown, fallbackMessage: string) => {
  const baseMessage = getReadableErrorMessage(error, fallbackMessage);

  if (!error || typeof error !== "object") {
    return baseMessage;
  }

  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) {
    return baseMessage;
  }

  try {
    const jsonBody = (await context.clone().json()) as Record<string, unknown>;
    const message =
      (typeof jsonBody.error === "string" && jsonBody.error.trim() && jsonBody.error) ||
      (typeof jsonBody.message === "string" && jsonBody.message.trim() && jsonBody.message);

    if (message) {
      return message;
    }
  } catch {
    // Fall back to text parsing below.
  }

  try {
    const textBody = await context.clone().text();
    if (textBody.trim()) {
      return textBody.trim();
    }
  } catch {
    // Ignore and return the base message.
  }

  return baseMessage;
};

const compareScope = (left: DataScope, right: DataScope) => scopeRank[left] - scopeRank[right];

const getHigherScope = (left: DataScope, right: DataScope): DataScope => {
  return compareScope(left, right) >= 0 ? left : right;
};

const toProfileRecord = (row: Record<string, unknown>): ProfileRecord => ({
  id: String(row.id),
  name: String(row.name),
  email: String(row.email),
  role: String(row.role),
  department: row.department ? String(row.department) : null,
  manager_id: row.manager_id ? String(row.manager_id) : null,
  reporting_manager_id: row.reporting_manager_id ? String(row.reporting_manager_id) : null,
  reporting_manager_name:
    row.reporting_manager && typeof row.reporting_manager === "object" && "name" in (row.reporting_manager as Record<string, unknown>)
      ? ((row.reporting_manager as Record<string, unknown>).name ? String((row.reporting_manager as Record<string, unknown>).name) : null)
      : null,
});

const createUserProfileFallback = (user: AuthUser): ProfileRecord => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  manager_id: user.managerId,
  reporting_manager_id: user.reportingManagerId,
  reporting_manager_name: user.reportingManagerName,
});

const mapProfilesById = (profiles: ProfileRecord[]) =>
  profiles.reduce<Record<string, ProfileRecord>>((accumulator, profile) => {
    accumulator[profile.id] = profile;
    return accumulator;
  }, {});

export const fetchCurrentUserProfile = async (userId: string): Promise<ProfileRecord | null> => {
  const withManagerResponse = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_WITH_MANAGER)
    .eq("id", userId)
    .single();

  if (!withManagerResponse.error && withManagerResponse.data) {
    return toProfileRecord(withManagerResponse.data as Record<string, unknown>);
  }

  if (!isMissingResourceError(withManagerResponse.error)) {
    if (isNoRowsError(withManagerResponse.error)) {
      return null;
    }

    throw withManagerResponse.error;
  }

  const fallbackResponse = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FALLBACK)
    .eq("id", userId)
    .single();

  if (fallbackResponse.error) {
    if (isNoRowsError(fallbackResponse.error)) {
      return null;
    }

    throw fallbackResponse.error;
  }

  return toProfileRecord({
    ...((fallbackResponse.data ?? {}) as Record<string, unknown>),
    manager_id: null,
    reporting_manager_id: null,
    reporting_manager: null,
  });
};

export const fetchAccessContext = async (userId: string): Promise<AccessContextResult> => {
  const profile = await fetchCurrentUserProfile(userId);
  if (!profile) {
    throw new AccessContextError(
      "profile_missing",
      "Login succeeded in Supabase Auth, but no matching profile row was found in `profiles` for this user.",
    );
  }

  const role = normalizeRole(profile.role);
  if (!role) {
    throw new AccessContextError(
      "role_invalid",
      `The profile row exists, but the role "${profile.role}" is invalid. Expected admin, hr, manager, or employee.`,
    );
  }

  const [permissionResponse, moduleResponse] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("module, can_view, can_create, can_update, can_delete, can_approve, data_scope")
      .eq("role", role),
    supabase
      .from("module_access")
      .select("module, label, route_path, sort_order, is_enabled")
      .eq("is_enabled", true)
      .order("sort_order"),
  ]);

  const usedFallbackPermissions =
    Boolean(permissionResponse.error && isMissingResourceError(permissionResponse.error)) ||
    Boolean(moduleResponse.error && isMissingResourceError(moduleResponse.error)) ||
    !permissionResponse.data?.length;

  if (permissionResponse.error && !isMissingResourceError(permissionResponse.error)) {
    throw permissionResponse.error;
  }

  if (moduleResponse.error && !isMissingResourceError(moduleResponse.error)) {
    throw moduleResponse.error;
  }

  const permissions = resolvePermissionRows(
    role,
    (permissionResponse.data ?? null) as PermissionRowRecord[] | null,
    (moduleResponse.data ?? null) as ModuleAccessRowRecord[] | null,
  );

  const user: AuthUser = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role,
    department: profile.department,
    managerId: profile.manager_id,
    reportingManagerId: profile.reporting_manager_id,
    reportingManagerName: profile.reporting_manager_name,
  };

  return {
    user,
    permissions,
    permissionMap: createPermissionMap(permissions),
    usedFallbackPermissions,
  };
};

const applyProfileFilter = <
  T extends {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  },
>(
  query: T,
  filter?: ProfileFilter,
) => {
  if (!filter) {
    return query;
  }

  if (filter.type === "eq") {
    return query.eq(filter.column, filter.value);
  }

  return query.in(filter.column, filter.value);
};

const fetchProfilesByQuery = async (filter?: ProfileFilter) => {
  let withManagerQuery = supabase.from("profiles").select(PROFILE_SELECT_WITH_MANAGER);
  withManagerQuery = applyProfileFilter(withManagerQuery, filter);

  const withManagerResponse = await withManagerQuery.order("name");
  if (!withManagerResponse.error) {
    return (withManagerResponse.data ?? []).map((row) => toProfileRecord(row as Record<string, unknown>));
  }

  if (!isMissingResourceError(withManagerResponse.error)) {
    throw withManagerResponse.error;
  }

  let fallbackQuery = supabase.from("profiles").select(PROFILE_SELECT_FALLBACK);
  fallbackQuery = applyProfileFilter(fallbackQuery, filter);

  const fallbackResponse = await fallbackQuery.order("name");
  if (fallbackResponse.error) {
    throw fallbackResponse.error;
  }

  return (fallbackResponse.data ?? []).map((row) =>
    toProfileRecord({
      ...(row as Record<string, unknown>),
      manager_id: null,
      reporting_manager_id: null,
      reporting_manager: null,
    }),
  );
};

export const fetchProfilesForScope = async (
  user: AuthUser,
  scope: DataScope,
  options?: { includeSelf?: boolean; fallbackToDepartment?: boolean },
): Promise<ProfileRecord[]> => {
  const includeSelf = options?.includeSelf ?? false;
  const fallbackToDepartment = options?.fallbackToDepartment ?? false;

  if (scope === "none") {
    return [];
  }

  if (scope === "own") {
    return [createUserProfileFallback(user)];
  }

  if (scope === "team") {
    try {
      const rows = await fetchProfilesByQuery({ type: "eq", column: "manager_id", value: user.id });
      const profiles = includeSelf ? [createUserProfileFallback(user), ...rows] : rows;
      return dedupeProfiles(profiles);
    } catch (error) {
      if (!fallbackToDepartment || !user.department) {
        throw error;
      }

      const rows = await fetchProfilesByQuery({ type: "eq", column: "department", value: user.department });
      const profiles = includeSelf ? [createUserProfileFallback(user), ...rows] : rows;
      return dedupeProfiles(profiles);
    }
  }

  const rows = await fetchProfilesByQuery();
  return includeSelf ? dedupeProfiles([createUserProfileFallback(user), ...rows]) : rows;
};

const dedupeProfiles = (profiles: ProfileRecord[]) => {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.id)) {
      return false;
    }

    seen.add(profile.id);
    return true;
  });
};

export const getScopeForModule = (
  permissionMap: PermissionMap,
  module: AppModule,
  fallbackScope: DataScope = "none",
) => {
  const permission = getModulePermission(permissionMap, module);
  return permission.canView ? permission.dataScope : fallbackScope;
};

const getUserIdsForScope = async (
  user: AuthUser,
  scope: DataScope,
  options?: { includeSelf?: boolean; fallbackToDepartment?: boolean },
) => {
  const profiles = await fetchProfilesForScope(user, scope, options);
  return profiles.map((profile) => profile.id);
};

const fetchProfilesByIds = async (ids: string[]) => {
  if (!ids.length) {
    return [];
  }

  const profiles = await fetchProfilesByQuery({ type: "in", column: "id", value: ids });
  return profiles;
};

export const fetchVisibleEmployees = async (user: AuthUser, permissionMap: PermissionMap) => {
  const scope = getScopeForModule(permissionMap, "employees");
  return fetchProfilesForScope(user, scope, { includeSelf: true, fallbackToDepartment: user.role === "manager" });
};

export const fetchTeamMembers = async (user: AuthUser, permissionMap: PermissionMap) => {
  const permission = getModulePermission(permissionMap, "team");
  if (!permission.canView) {
    return [];
  }

  return fetchProfilesForScope(user, permission.dataScope, {
    includeSelf: permission.dataScope === "all",
    fallbackToDepartment: true,
  });
};

const fetchAttendanceRows = async (
  user: AuthUser,
  permission: ReturnType<typeof getModulePermission>,
): Promise<{ mode: AttendanceSchemaMode; rows: Array<Record<string, unknown>> }> => {
  let currentSchemaQuery = supabase
    .from("attendance")
    .select(CURRENT_ATTENDANCE_PAUSE_SELECT)
    .order("date", { ascending: false });

  if (permission.dataScope === "own") {
    currentSchemaQuery = currentSchemaQuery.eq("user_id", user.id);
  }

  const currentSchemaResponse = await currentSchemaQuery;
  if (!currentSchemaResponse.error) {
    return {
      mode: "current",
      rows: withDefaultPauseMetadata((currentSchemaResponse.data ?? []) as Array<Record<string, unknown>>),
    };
  }

  let currentSchemaFallbackQuery = supabase
    .from("attendance")
    .select(CURRENT_ATTENDANCE_BASE_SELECT)
    .order("date", { ascending: false });

  if (permission.dataScope === "own") {
    currentSchemaFallbackQuery = currentSchemaFallbackQuery.eq("user_id", user.id);
  }

  const currentSchemaFallbackResponse = isMissingResourceError(currentSchemaResponse.error)
    ? await currentSchemaFallbackQuery
    : null;

  if (currentSchemaFallbackResponse && !currentSchemaFallbackResponse.error) {
    return {
      mode: "current",
      rows: withDefaultPauseMetadata((currentSchemaFallbackResponse.data ?? []) as Array<Record<string, unknown>>),
    };
  }

  if (currentSchemaFallbackResponse?.error && !isMissingResourceError(currentSchemaFallbackResponse.error)) {
    throw currentSchemaFallbackResponse.error;
  }

  if (!isMissingResourceError(currentSchemaResponse.error)) {
    throw currentSchemaResponse.error;
  }

  let legacySchemaQuery = supabase
    .from("attendance")
    .select(LEGACY_ATTENDANCE_PAUSE_SELECT)
    .order("login_time", { ascending: false });

  if (permission.dataScope === "own") {
    legacySchemaQuery = legacySchemaQuery.eq("user_id", user.id);
  }

  const legacySchemaResponse = await legacySchemaQuery;
  if (!legacySchemaResponse.error) {
    return {
      mode: "legacy",
      rows: withDefaultPauseMetadata((legacySchemaResponse.data ?? []) as Array<Record<string, unknown>>),
    };
  }

  let legacySchemaFallbackQuery = supabase
    .from("attendance")
    .select(LEGACY_ATTENDANCE_BASE_SELECT)
    .order("login_time", { ascending: false });

  if (permission.dataScope === "own") {
    legacySchemaFallbackQuery = legacySchemaFallbackQuery.eq("user_id", user.id);
  }

  const legacySchemaFallbackResponse = isMissingResourceError(legacySchemaResponse.error)
    ? await legacySchemaFallbackQuery
    : null;

  if (legacySchemaFallbackResponse && !legacySchemaFallbackResponse.error) {
    return {
      mode: "legacy",
      rows: withDefaultPauseMetadata((legacySchemaFallbackResponse.data ?? []) as Array<Record<string, unknown>>),
    };
  }

  if (legacySchemaFallbackResponse?.error && !isMissingResourceError(legacySchemaFallbackResponse.error)) {
    throw legacySchemaFallbackResponse.error;
  }

  if (
    isMissingResourceError(currentSchemaResponse.error) &&
    (!currentSchemaFallbackResponse || isMissingResourceError(currentSchemaFallbackResponse.error)) &&
    isMissingResourceError(legacySchemaResponse.error) &&
    (!legacySchemaFallbackResponse || isMissingResourceError(legacySchemaFallbackResponse.error))
  ) {
    return { mode: "legacy", rows: [] };
  }

  throw legacySchemaResponse.error;
};

export const fetchAttendanceRecords = async (user: AuthUser, permissionMap: PermissionMap): Promise<AttendanceRecord[]> => {
  const permission = getModulePermission(permissionMap, "attendance");
  if (!permission.canView) {
    return [];
  }

  const attendanceResult = await fetchAttendanceRows(user, permission);
  const aggregatedRows =
    attendanceResult.mode === "current"
      ? aggregateCurrentAttendanceRows(attendanceResult.rows)
      : aggregateLegacyAttendanceRows(attendanceResult.rows);

  const userIds = Array.from(new Set(aggregatedRows.map((row) => row.userId)));
  const profiles =
    permission.dataScope === "own" ? [createUserProfileFallback(user)] : await fetchProfilesByIds(userIds);
  const profilesById = mapProfilesById(profiles);

  return aggregatedRows.map<AttendanceRecord>((row) => {
    const userId = row.userId;
    const profile = profilesById[userId];

    return {
      id: row.id,
      userId,
      employeeName: profile?.name ?? (userId === user.id ? user.name : "Team member"),
      department: profile?.department ?? (userId === user.id ? user.department : null),
      date: row.date,
      checkInIso: row.checkInIso,
      checkOutIso: row.checkOutIso,
      checkIn: formatTime(row.checkInIso),
      checkOut: formatTime(row.checkOutIso),
      totalMinutes: row.totalMinutes,
      totalHours: formatWorkedDuration(row.totalMinutes),
      status: row.status,
      isPaused: row.isPaused,
      pauseStartIso: row.pauseStartIso,
      totalPausedDurationSeconds: row.totalPausedDurationSeconds,
    };
  });
};

export const checkInCurrentUser = async (user: AuthUser): Promise<string> => {
  const now = new Date();
  const nowIso = now.toISOString();
  const date = getTodayDateKey();

  const existingResponse = await supabase
    .from("attendance")
    .select("id, check_in, check_out, created_at")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (!existingResponse.error) {
    const existingRows = existingResponse.data ?? [];
    const openRow = existingRows.find((row) => !row.check_out);

    if (openRow?.id) {
      if (!openRow.check_out) {
        return openRow.check_in ? String(openRow.check_in) : nowIso;
      }
    }

    if (existingRows.length > 0) {
      throw new Error(getDayAlreadyRecordedMessage());
    }

    await closeStaleCurrentAttendanceRows(user.id, date);

    const { error } = await supabase.from("attendance").insert(
      {
        user_id: user.id,
        date,
        check_in: nowIso,
        status: "Pending",
      },
    );

    if (error) {
      throw error;
    }

    return nowIso;
  }

  if (!isMissingResourceError(existingResponse.error)) {
    throw existingResponse.error;
  }

  const { startIso, endIso } = getBusinessDateRange(date);
  const legacyExistingResponse = await supabase
    .from("attendance")
    .select("id, login_time, logout_time")
    .eq("user_id", user.id)
    .gte("login_time", startIso)
    .lt("login_time", endIso)
    .order("login_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (
    legacyExistingResponse.error &&
    !isNoRowsError(legacyExistingResponse.error) &&
    !isMissingResourceError(legacyExistingResponse.error)
  ) {
    throw legacyExistingResponse.error;
  }

  if (legacyExistingResponse.data?.id) {
    if (!legacyExistingResponse.data.logout_time) {
      return legacyExistingResponse.data.login_time ? String(legacyExistingResponse.data.login_time) : nowIso;
    }

    throw new Error(getDayAlreadyRecordedMessage());
  }

  await closeStaleLegacyAttendanceRows(user.id, startIso);

  const legacyInsertPayload = {
    user_id: user.id,
    login_time: nowIso,
    work_date: date,
    duration_minutes: 0,
    shift_minutes: 540,
    attendance_status: "Pending",
  };

  const legacyInsertResponse = await supabase.from("attendance").insert(legacyInsertPayload);

  if (legacyInsertResponse.error) {
    if (!isMissingResourceError(legacyInsertResponse.error)) {
      throw legacyInsertResponse.error;
    }

    const fallbackLegacyInsertResponse = await supabase.from("attendance").insert({
      user_id: user.id,
      login_time: nowIso,
      duration_minutes: 0,
      shift_minutes: 540,
      attendance_status: "Pending",
    });

    if (fallbackLegacyInsertResponse.error) {
      throw fallbackLegacyInsertResponse.error;
    }
  }

  return nowIso;
};

const fetchCurrentOpenAttendanceRows = async (userId: string, date: string) => {
  const withPauseResponse = await supabase
    .from("attendance")
    .select("id, check_in, check_out, created_at, is_paused, pause_start_time, total_paused_duration")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (!withPauseResponse.error) {
    return {
      mode: "current" as const,
      rows: withDefaultPauseMetadata((withPauseResponse.data ?? []) as Array<Record<string, unknown>>),
      pauseColumnsAvailable: true,
    };
  }

  if (!isMissingResourceError(withPauseResponse.error)) {
    throw withPauseResponse.error;
  }

  const fallbackResponse = await supabase
    .from("attendance")
    .select("id, check_in, check_out, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (!fallbackResponse.error) {
    return {
      mode: "current" as const,
      rows: withDefaultPauseMetadata((fallbackResponse.data ?? []) as Array<Record<string, unknown>>),
      pauseColumnsAvailable: false,
    };
  }

  if (!isMissingResourceError(fallbackResponse.error)) {
    throw fallbackResponse.error;
  }

  return null;
};

const fetchLegacyOpenAttendanceRow = async (userId: string, startIso: string, endIso: string) => {
  const withPauseResponse = await supabase
    .from("attendance")
    .select("id, login_time, logout_time, is_paused, pause_start_time, total_paused_duration")
    .eq("user_id", userId)
    .gte("login_time", startIso)
    .lt("login_time", endIso)
    .is("logout_time", null)
    .order("login_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!withPauseResponse.error) {
    return {
      row: withPauseResponse.data
        ? withDefaultPauseMetadata([withPauseResponse.data as Record<string, unknown>])[0]
        : null,
      pauseColumnsAvailable: true,
    };
  }

  if (!isMissingResourceError(withPauseResponse.error)) {
    throw withPauseResponse.error;
  }

  const fallbackResponse = await supabase
    .from("attendance")
    .select("id, login_time, logout_time")
    .eq("user_id", userId)
    .gte("login_time", startIso)
    .lt("login_time", endIso)
    .is("logout_time", null)
    .order("login_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fallbackResponse.error) {
    return {
      row: fallbackResponse.data
        ? withDefaultPauseMetadata([fallbackResponse.data as Record<string, unknown>])[0]
        : null,
      pauseColumnsAvailable: false,
    };
  }

  if (!isMissingResourceError(fallbackResponse.error)) {
    throw fallbackResponse.error;
  }

  return null;
};

export const pauseCurrentUser = async (user: AuthUser, date: string) => {
  const currentOpenAttendance = await fetchCurrentOpenAttendanceRows(user.id, date);

  if (currentOpenAttendance) {
    if (!currentOpenAttendance.pauseColumnsAvailable) {
      throw new Error(getPauseFieldsMissingMessage());
    }

    const openRow = currentOpenAttendance.rows.find((row) => !row.check_out);
    if (!openRow?.id) {
      throw new Error("No active attendance record exists for today.");
    }

    if (Boolean(openRow.is_paused)) {
      return;
    }

    const pauseStartIso = new Date().toISOString();
    const { error } = await supabase
      .from("attendance")
      .update({
        is_paused: true,
        pause_start_time: pauseStartIso,
      })
      .eq("id", String(openRow.id))
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { startIso, endIso } = getBusinessDateRange(date);
  const legacyOpenAttendance = await fetchLegacyOpenAttendanceRow(user.id, startIso, endIso);

  if (!legacyOpenAttendance) {
    throw new Error("No active attendance record exists for today.");
  }

  if (!legacyOpenAttendance.pauseColumnsAvailable) {
    throw new Error(getPauseFieldsMissingMessage());
  }

  if (!legacyOpenAttendance.row?.id) {
    throw new Error("No active attendance record exists for today.");
  }

  if (Boolean(legacyOpenAttendance.row.is_paused)) {
    return;
  }

  const pauseStartIso = new Date().toISOString();
  const { error } = await supabase
    .from("attendance")
    .update({
      is_paused: true,
      pause_start_time: pauseStartIso,
    })
    .eq("id", String(legacyOpenAttendance.row.id))
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
};

export const resumeCurrentUser = async (user: AuthUser, date: string) => {
  const now = new Date();
  const currentOpenAttendance = await fetchCurrentOpenAttendanceRows(user.id, date);

  if (currentOpenAttendance) {
    if (!currentOpenAttendance.pauseColumnsAvailable) {
      throw new Error(getPauseFieldsMissingMessage());
    }

    const openRow = currentOpenAttendance.rows.find((row) => !row.check_out);
    if (!openRow?.id) {
      throw new Error("No active attendance record exists for today.");
    }

    if (!Boolean(openRow.is_paused)) {
      return;
    }

    const resumedPausedDurationSeconds =
      Math.max(Number(openRow.total_paused_duration ?? 0), 0) +
      getOngoingPauseDurationSeconds(
        openRow.pause_start_time ? String(openRow.pause_start_time) : null,
        now,
      );

    const { error } = await supabase
      .from("attendance")
      .update({
        is_paused: false,
        pause_start_time: null,
        total_paused_duration: resumedPausedDurationSeconds,
      })
      .eq("id", String(openRow.id))
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { startIso, endIso } = getBusinessDateRange(date);
  const legacyOpenAttendance = await fetchLegacyOpenAttendanceRow(user.id, startIso, endIso);

  if (!legacyOpenAttendance) {
    throw new Error("No active attendance record exists for today.");
  }

  if (!legacyOpenAttendance.pauseColumnsAvailable) {
    throw new Error(getPauseFieldsMissingMessage());
  }

  if (!legacyOpenAttendance.row?.id) {
    throw new Error("No active attendance record exists for today.");
  }

  if (!Boolean(legacyOpenAttendance.row.is_paused)) {
    return;
  }

  const resumedPausedDurationSeconds =
    Math.max(Number(legacyOpenAttendance.row.total_paused_duration ?? 0), 0) +
    getOngoingPauseDurationSeconds(
      legacyOpenAttendance.row.pause_start_time ? String(legacyOpenAttendance.row.pause_start_time) : null,
      now,
    );

  const { error } = await supabase
    .from("attendance")
    .update({
      is_paused: false,
      pause_start_time: null,
      total_paused_duration: resumedPausedDurationSeconds,
    })
    .eq("id", String(legacyOpenAttendance.row.id))
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
};

export const checkOutCurrentUser = async (user: AuthUser, date: string) => {
  const currentOpenAttendance = await fetchCurrentOpenAttendanceRows(user.id, date);

  if (currentOpenAttendance) {
    const currentRows = currentOpenAttendance.rows;
    const openRows = currentRows.filter((row) => !row.check_out);
    const currentRow = openRows[0];

    if (!currentRow) {
      throw new Error("No active attendance record exists for today.");
    }

    const nowIso = new Date().toISOString();
    const earliestCheckIn = openRows.reduce<string | null>(
      (earliest, row) => {
        const checkInValue = row.check_in ? String(row.check_in) : null;
        if (!checkInValue) {
          return earliest;
        }

        if (!earliest) {
          return checkInValue;
        }

        return (getParsedTimestamp(checkInValue) ?? Number.POSITIVE_INFINITY) <=
          (getParsedTimestamp(earliest) ?? Number.POSITIVE_INFINITY)
          ? checkInValue
          : earliest;
      },
      null,
    );
    const pausedDurationSeconds = openRows.reduce((total, row) => {
      const pauseMetadata = getPauseMetadata(row);
      return total + getEffectivePausedDurationSeconds(pauseMetadata, nowIso);
    }, 0);
    const durationMinutes = calculateDurationMinutes(
      earliestCheckIn ?? String(currentRow.check_in ?? ""),
      nowIso,
      { pausedDurationSeconds },
    );
    const status = calculateAttendanceStatus(durationMinutes);
    const idsToClose = openRows.map((row) => String(row.id));
    const currentUpdatePayload: Record<string, unknown> = {
      check_out: nowIso,
      status,
    };

    if (currentOpenAttendance.pauseColumnsAvailable) {
      currentUpdatePayload.is_paused = false;
      currentUpdatePayload.pause_start_time = null;
      currentUpdatePayload.total_paused_duration = pausedDurationSeconds;
    }

    const { error } = await supabase
      .from("attendance")
      .update(currentUpdatePayload)
      .in("id", idsToClose)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { startIso, endIso } = getBusinessDateRange(date);
  const legacyOpenAttendance = await fetchLegacyOpenAttendanceRow(user.id, startIso, endIso);

  if (!legacyOpenAttendance?.row?.id) {
    throw new Error("No active attendance record exists for today.");
  }

  const now = new Date();
  const loginTime = legacyOpenAttendance.row.login_time
    ? parseAttendanceDateValue(String(legacyOpenAttendance.row.login_time))
    : null;
  const pausedDurationSeconds = getEffectivePausedDurationSeconds(getPauseMetadata(legacyOpenAttendance.row), now);
  const durationMinutes = loginTime
    ? calculateDurationMinutes(loginTime.toISOString(), now.toISOString(), { pausedDurationSeconds })
    : 0;
  const status = calculateAttendanceStatus(durationMinutes);
  const legacyUpdatePayload: Record<string, unknown> = {
    logout_time: now.toISOString(),
    duration_minutes: durationMinutes,
    attendance_status: status,
  };

  if (legacyOpenAttendance.pauseColumnsAvailable) {
    legacyUpdatePayload.is_paused = false;
    legacyUpdatePayload.pause_start_time = null;
    legacyUpdatePayload.total_paused_duration = pausedDurationSeconds;
  }

  const legacyUpdateResponse = await supabase
    .from("attendance")
    .update(legacyUpdatePayload)
    .eq("id", legacyOpenAttendance.row.id)
    .eq("user_id", user.id);

  if (legacyUpdateResponse.error) {
    throw legacyUpdateResponse.error;
  }
};

export const fetchLeaveRecords = async (user: AuthUser, permissionMap: PermissionMap): Promise<LeaveRecord[]> => {
  const permission = getModulePermission(permissionMap, "leave");
  if (!permission.canView) {
    return [];
  }

  let leaveQuery = supabase
    .from("leaves")
    .select("id, user_id, type, start_date, end_date, status, days, reason, approver_id, created_at")
    .order("created_at", { ascending: false });

  if (permission.dataScope === "own") {
    leaveQuery = leaveQuery.eq("user_id", user.id);
  } else if (permission.dataScope === "team") {
    const userIds = await getUserIdsForScope(user, "team", { includeSelf: true, fallbackToDepartment: true });
    leaveQuery = leaveQuery.in("user_id", userIds);
  }

  const { data, error } = await leaveQuery;
  if (error) {
    if (isMissingResourceError(error)) {
      return [];
    }

    throw error;
  }

  const userIds = Array.from(new Set((data ?? []).map((row) => String(row.user_id))));
  const profiles =
    permission.dataScope === "own" ? [createUserProfileFallback(user)] : await fetchProfilesByIds(userIds);
  const profilesById = mapProfilesById(profiles);

  return (data ?? []).map<LeaveRecord>((row) => {
    const userId = String(row.user_id);
    const profile = profilesById[userId] ?? createUserProfileFallback(user);
    return {
      id: String(row.id),
      userId,
      employeeName: profile.name,
      type: String(row.type),
      from: String(row.start_date),
      to: String(row.end_date),
      status: String(row.status ?? "Pending"),
      days: Number(row.days ?? 0),
      reason: row.reason ? String(row.reason) : null,
      approverId: row.approver_id ? String(row.approver_id) : null,
    };
  });
};

export const createLeaveRequest = async (
  user: AuthUser,
  payload: { type: string; from: string; to: string; reason: string },
) => {
  const start = new Date(payload.from);
  const end = new Date(payload.to);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const { error } = await supabase.from("leaves").insert({
    user_id: user.id,
    type: payload.type,
    start_date: payload.from,
    end_date: payload.to,
    reason: payload.reason,
    days,
  });

  if (error) {
    throw error;
  }
};

export const updateLeaveStatus = async (
  leaveId: string,
  approverId: string,
  status: "Approved" | "Rejected",
) => {
  const { error } = await supabase
    .from("leaves")
    .update({ status, approver_id: approverId })
    .eq("id", leaveId);

  if (error) {
    throw error;
  }
};

export const fetchPayrollRecords = async (user: AuthUser, permissionMap: PermissionMap): Promise<PayrollRecord[]> => {
  const permission = getModulePermission(permissionMap, "payroll");
  if (!permission.canView) {
    return [];
  }

  let payrollQuery = supabase
    .from("payroll")
    .select("id, user_id, month, gross_pay, deductions, net_pay, payslip_url, created_at")
    .order("created_at", { ascending: false });

  if (permission.dataScope === "own") {
    payrollQuery = payrollQuery.eq("user_id", user.id);
  } else if (permission.dataScope === "team") {
    const userIds = await getUserIdsForScope(user, "team", { includeSelf: false, fallbackToDepartment: true });
    payrollQuery = payrollQuery.in("user_id", userIds);
  }

  const { data, error } = await payrollQuery;
  if (error) {
    if (isMissingResourceError(error)) {
      return [];
    }

    throw error;
  }

  const userIds = Array.from(new Set((data ?? []).map((row) => String(row.user_id))));
  const profiles =
    permission.dataScope === "own" ? [createUserProfileFallback(user)] : await fetchProfilesByIds(userIds);
  const profilesById = mapProfilesById(profiles);

  return (data ?? []).map<PayrollRecord>((row) => {
    const userId = String(row.user_id);
    const profile = profilesById[userId] ?? createUserProfileFallback(user);
    return {
      id: String(row.id),
      userId,
      employeeName: profile.name,
      month: String(row.month),
      gross: Number(row.gross_pay ?? 0),
      deductions: Number(row.deductions ?? 0),
      net: Number(row.net_pay ?? 0),
      payslipUrl: row.payslip_url ? String(row.payslip_url) : null,
    };
  });
};

export const fetchPerformanceRecords = async (
  user: AuthUser,
  permissionMap: PermissionMap,
): Promise<PerformanceRecord[]> => {
  const permission = getModulePermission(permissionMap, "performance");
  if (!permission.canView) {
    return [];
  }

  let performanceQuery = supabase
    .from("performance_reviews")
    .select("id, user_id, objective, progress, summary, reviewer_name, created_at")
    .order("created_at", { ascending: false });

  if (permission.dataScope === "own") {
    performanceQuery = performanceQuery.eq("user_id", user.id);
  } else if (permission.dataScope === "team") {
    const userIds = await getUserIdsForScope(user, "team", { includeSelf: false, fallbackToDepartment: true });
    performanceQuery = performanceQuery.in("user_id", userIds);
  }

  const { data, error } = await performanceQuery;
  if (error) {
    if (isMissingResourceError(error)) {
      return [];
    }

    throw error;
  }

  const userIds = Array.from(new Set((data ?? []).map((row) => String(row.user_id))));
  const profiles =
    permission.dataScope === "own" ? [createUserProfileFallback(user)] : await fetchProfilesByIds(userIds);
  const profilesById = mapProfilesById(profiles);

  return (data ?? []).map<PerformanceRecord>((row) => {
    const userId = String(row.user_id);
    const profile = profilesById[userId] ?? createUserProfileFallback(user);
    return {
      id: String(row.id),
      userId,
      employeeName: profile.name,
      objective: String(row.objective),
      progress: Number(row.progress ?? 0),
      summary: String(row.summary ?? ""),
      reviewerName: String(row.reviewer_name ?? "Reviewer"),
      createdAt: String(row.created_at ?? ""),
    };
  });
};

export const fetchRecruitmentCandidates = async (): Promise<RecruitmentCandidateRecord[]> => {
  const { data, error } = await supabase
    .from("recruitment_candidates")
    .select("id, name, position, stage")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingResourceError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    position: String(row.position),
    stage: String(row.stage),
  }));
};

export const fetchWallOfFameKudos = async (): Promise<KudosRecord[]> => {
  const { data, error } = await supabase
    .from("kudos")
    .select("id, from_user_id, to_user_id, from_name, to_name, from_role, message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingResourceError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    fromUserId: row.from_user_id ? String(row.from_user_id) : null,
    toUserId: row.to_user_id ? String(row.to_user_id) : null,
    fromName: String(row.from_name),
    toName: String(row.to_name),
    fromRole: String(row.from_role),
    message: String(row.message),
    createdAt: String(row.created_at),
  }));
};

export const fetchPersonalKudos = async (user: AuthUser): Promise<KudosRecord[]> => {
  const userScopedResponse = await supabase
    .from("kudos")
    .select("id, from_user_id, to_user_id, from_name, to_name, from_role, message, created_at")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });

  if (!userScopedResponse.error) {
    return (userScopedResponse.data ?? []).map((row) => ({
      id: String(row.id),
      fromUserId: row.from_user_id ? String(row.from_user_id) : null,
      toUserId: row.to_user_id ? String(row.to_user_id) : null,
      fromName: String(row.from_name),
      toName: String(row.to_name),
      fromRole: String(row.from_role),
      message: String(row.message),
      createdAt: String(row.created_at),
    }));
  }

  if (!isMissingResourceError(userScopedResponse.error)) {
    throw userScopedResponse.error;
  }

  const nameFallbackResponse = await supabase
    .from("kudos")
    .select("id, from_user_id, to_user_id, from_name, to_name, from_role, message, created_at")
    .eq("to_name", user.name)
    .order("created_at", { ascending: false });

  if (nameFallbackResponse.error) {
    throw nameFallbackResponse.error;
  }

  return (nameFallbackResponse.data ?? []).map((row) => ({
    id: String(row.id),
    fromUserId: row.from_user_id ? String(row.from_user_id) : null,
    toUserId: row.to_user_id ? String(row.to_user_id) : null,
    fromName: String(row.from_name),
    toName: String(row.to_name),
    fromRole: String(row.from_role),
    message: String(row.message),
    createdAt: String(row.created_at),
  }));
};

export const fetchKudosRecipients = async (user: AuthUser, permissionMap: PermissionMap) => {
  const permission = getModulePermission(permissionMap, "kudos");
  if (!permission.canCreate) {
    return [];
  }

  const scope = getHigherScope(permission.dataScope, user.role === "manager" ? "team" : permission.dataScope);
  const profiles = await fetchProfilesForScope(user, scope, {
    includeSelf: false,
    fallbackToDepartment: user.role === "manager",
  });

  return profiles.filter((profile) => profile.id !== user.id);
};

export const createKudos = async (
  fromUser: AuthUser,
  payload: { toUserId: string; toName: string; message: string },
) => {
  const { error } = await supabase.from("kudos").insert({
    from_user_id: fromUser.id,
    to_user_id: payload.toUserId,
    from_name: fromUser.name,
    to_name: payload.toName,
    from_role: fromUser.role,
    message: payload.message,
  });

  if (error) {
    throw error;
  }
};

export const fetchDepartmentCounts = async (user: AuthUser, permissionMap: PermissionMap) => {
  const profiles = await fetchProfilesForScope(user, getScopeForModule(permissionMap, "dashboard", "own"), {
    includeSelf: getScopeForModule(permissionMap, "dashboard", "own") === "own",
    fallbackToDepartment: user.role === "manager",
  });

  return Object.entries(
    profiles.reduce<Record<string, number>>((accumulator, profile) => {
      const department = profile.department ?? "Unassigned";
      accumulator[department] = (accumulator[department] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([department, count]) => ({ department, count }))
    .sort((left, right) => right.count - left.count);
};

export const fetchRoleCounts = async (user: AuthUser, permissionMap: PermissionMap) => {
  const scope = getScopeForModule(permissionMap, "employees", "own");
  const profiles = await fetchProfilesForScope(user, scope, { includeSelf: true, fallbackToDepartment: user.role === "manager" });

  return Object.entries(
    profiles.reduce<Record<string, number>>((accumulator, profile) => {
      accumulator[profile.role] = (accumulator[profile.role] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => left.role.localeCompare(right.role));
};

export const fetchAssignableManagers = async (): Promise<ManagerOption[]> => {
  const reportingManagerResponse = await supabase
    .from("reporting_managers")
    .select("id, name, department")
    .eq("is_active", true)
    .order("name");

  if (!reportingManagerResponse.error && (reportingManagerResponse.data?.length ?? 0) > 0) {
    return (reportingManagerResponse.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: null,
      department: row.department ? String(row.department) : null,
    }));
  }

  if (reportingManagerResponse.error && !isMissingResourceError(reportingManagerResponse.error)) {
    throw reportingManagerResponse.error;
  }

  const fallbackManagerResponse = await supabase
    .from("profiles")
    .select("id, name, email, department")
    .eq("role", "manager")
    .eq("is_active", true)
    .order("name");

  if (fallbackManagerResponse.error) {
    if (isMissingResourceError(fallbackManagerResponse.error)) {
      return [];
    }

    throw fallbackManagerResponse.error;
  }

  return (fallbackManagerResponse.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    department: row.department ? String(row.department) : null,
  }));
};

export const fetchAccessGrants = async (): Promise<AccessGrantRecord[]> => {
  const grantsWithReportingManagerResponse = await supabase
    .from("access_grants")
    .select("id, name, email, role, department, manager_id, reporting_manager_id, granted_by, invite_count, last_invited_at, auth_user_id, manager:profiles!access_grants_manager_id_fkey(name), reporting_manager:reporting_managers(name), grantor:profiles!access_grants_granted_by_fkey(name)")
    .order("last_invited_at", { ascending: false });

  if (grantsWithReportingManagerResponse.error && !isMissingResourceError(grantsWithReportingManagerResponse.error)) {
    throw grantsWithReportingManagerResponse.error;
  }

  const legacyGrantsResponse = grantsWithReportingManagerResponse.error
    ? await supabase
        .from("access_grants")
        .select("id, name, email, role, department, manager_id, granted_by, invite_count, last_invited_at, auth_user_id, manager:profiles!access_grants_manager_id_fkey(name), grantor:profiles!access_grants_granted_by_fkey(name)")
        .order("last_invited_at", { ascending: false })
    : null;

  if (legacyGrantsResponse?.error) {
    if (isMissingResourceError(legacyGrantsResponse.error)) {
      return [];
    }

    throw legacyGrantsResponse.error;
  }

  const rows = grantsWithReportingManagerResponse.error ? (legacyGrantsResponse?.data ?? []) : (grantsWithReportingManagerResponse.data ?? []);

  return rows.map((row) => {
    const managerRelation = row.manager as { name?: unknown } | { name?: unknown }[] | null;
    const reportingManagerRelation = row.reporting_manager as { name?: unknown } | { name?: unknown }[] | null;
    const grantorRelation = row.grantor as { name?: unknown } | { name?: unknown }[] | null;
    const reportingManagerNameFromRelation =
      Array.isArray(reportingManagerRelation)
        ? (reportingManagerRelation[0]?.name ? String(reportingManagerRelation[0].name) : null)
        : reportingManagerRelation?.name
          ? String(reportingManagerRelation.name)
          : null;
    const legacyManagerName =
      Array.isArray(managerRelation)
        ? (managerRelation[0]?.name ? String(managerRelation[0].name) : null)
        : managerRelation?.name
          ? String(managerRelation.name)
          : null;
    const grantedByName =
      Array.isArray(grantorRelation)
        ? (grantorRelation[0]?.name ? String(grantorRelation[0].name) : null)
        : grantorRelation?.name
          ? String(grantorRelation.name)
          : null;

    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as AssignableRole,
      department: row.department ? String(row.department) : null,
      reportingManagerId: row.reporting_manager_id ? String(row.reporting_manager_id) : null,
      reportingManagerName: reportingManagerNameFromRelation ?? legacyManagerName,
      grantedById: row.granted_by ? String(row.granted_by) : null,
      grantedByName,
      inviteCount: Number(row.invite_count ?? 0),
      lastInvitedAt: String(row.last_invited_at ?? ""),
      authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    };
  });
};

export const inviteUserWithRole = async (payload: AccessInvitePayload) => {
  const { data, error } = await supabase.functions.invoke("admin-invite-user", {
    body: {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      department: payload.department.trim() || "Operations",
      reportingManagerId: payload.reportingManagerId ?? null,
    },
  });

  if (error) {
    throw new Error(await getFunctionInvokeErrorMessage(error, "Failed to send the invitation."));
  }

  return data as { success: boolean; message: string };
};
