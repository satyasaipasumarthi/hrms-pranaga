
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  TrendingUp,
  BriefcaseBusiness,
  Building2,
  CalendarOff,
  ClipboardCheck,
  Droplet,
  Star,
  UserCheck,
  Users,
} from "lucide-react";

import StatCard from "@/components/ui/StatCard";
import PageWrapper from "@/components/ui/PageWrapper";
import { useAuth } from "@/hooks/useAuth";
import { getBusinessDateKey } from "@/lib/attendance";

import {
  fetchAttendanceRecords,
  fetchLeaveRecords,
  fetchOnboardingDemographics,
  fetchOrgDashboardCounts,
  fetchPersonalKudos,
  fetchProfilesForScope,
  getScopeForModule,
  type AttendanceRecord,
  type KudosRecord,
  type LeaveRecord,
  type OnboardingDemographicRecord,
  type ProfileRecord,
} from "@/lib/hrms-api";

type DistributionItem = {
  label: string;
  count: number;
};

function countValues(values: Array<string | null>): DistributionItem[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const label = value?.trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts, ([label, count]) => ({
    label,
    count,
  })).sort((a, b) => b.count - a.count);
}

// ==================================================
// PASTEL CHART COLOR PALETTE
// ==================================================

const CHART_COLORS = [
  "#56A8F0", // bright pastel blue
  "#A779F5", // lavender purple
  "#F17FB2", // pastel pink
  "#49D8C0", // mint teal
  "#F7D879", // pastel yellow
  "#78DCCB", // soft mint
  "#C49AF7", // soft lavender
];

const STATUS_COLORS: Record<string, string> = {
  Present: "#49D8C0",
  Absent: "#EF4444",
  "On Leave": "#F7D879",
  Male: "#56A8F0",
  Female: "#F17FB2",
};

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0 h-full rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
    >
      <h3 className="mb-5 flex items-center gap-3 font-heading text-sm font-semibold text-[#14264F]">
        

<span
  className={`chart-title-icon ${
    title === "Gender Distribution"
      ? "chart-title-icon--gender"
      : title === "Role Type Distribution"
        ? "chart-title-icon--role-type"
        : title === "Employee Status"
          ? "chart-title-icon--employee-status"
          : title === "Attendance Rate Trend"
            ? "chart-title-icon--attendance-trend"
            : title === "Blood Group Distribution"
              ? "chart-title-icon--blood-group"
              : "chart-title-icon--default"
  }`}
>
  <Icon className="h-5 w-5" />
</span>


        {title}
      </h3>

      {children}
    </motion.section>
  );
}

// ==================================================
// DONUT / PIE CHART
// ==================================================

function DonutChart({
  data,
  total,
}: {
  data: DistributionItem[];
  total: number;
}) {
  const visibleData = data.filter((item) => item.count > 0);

  const actualTotal = visibleData.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  let cumulative = 0;

  const gradient =
    actualTotal > 0
      ? visibleData
          .map((item, index) => {
            const start = cumulative;
            cumulative += (item.count / actualTotal) * 100;

            return `${
              STATUS_COLORS[item.label] ??
              CHART_COLORS[index % CHART_COLORS.length]
            } ${start}% ${cumulative}%`;
          })
          .join(", ")
      : "#E8EEF6 0% 100%";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        />

        <div
          className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full text-center"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <span className="text-2xl font-bold text-[#14264F]">
            {total}
          </span>
          <span className="text-[10px] text-[#71829B]">
            Employees
          </span>
        </div>
      </div>

      <div className="w-full min-w-0 space-y-3">
        {visibleData.length > 0 ? (
          visibleData.map((item, index) => {
            const percentage =
              actualTotal > 0
                ? Math.round((item.count / actualTotal) * 100)
                : 0;

            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[item.label] ??
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />

                  <span className="truncate text-[#52647D]">
                    {item.label}
                  </span>
                </div>

                <span className="shrink-0 text-[#71829B]">
                  {item.count} ({percentage}%)
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[#71829B]">
            No data available.
          </p>
        )}
      </div>
    </div>
  );
}

// ==================================================
// DEPARTMENT HORIZONTAL BAR CHART
// ==================================================

function HorizontalBarChart({
  data,
}: {
  data: DistributionItem[];
}) {
  const maximum = Math.max(1, ...data.map((item) => item.count));

  if (!data.length) {
    return (
      <p className="text-sm text-[#71829B]">
        No department data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div
          key={item.label}
          className="grid grid-cols-[minmax(95px,145px)_minmax(0,1fr)_28px] items-center gap-3"
        >
          <span
            className="truncate text-right text-xs text-[#52647D]"
            title={item.label}
          >
            {item.label}
          </span>

          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: "#EDF1F7" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${(item.count / maximum) * 100}%`,
              }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
          </div>

          <span className="text-xs tabular-nums text-[#71829B]">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ==================================================
// BLOOD GROUP BAR CHART
// ==================================================

function BloodGroupChart({
  data,
}: {
  data: DistributionItem[];
}) {
  const order = [
    "O+",
    "O-",
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "Unknown",
  ];

  const sorted = [...data].sort((a, b) => {
    const aIndex = order.indexOf(a.label);
    const bIndex = order.indexOf(b.label);

    return (
      (aIndex === -1 ? 999 : aIndex) -
      (bIndex === -1 ? 999 : bIndex)
    );
  });

  const maximum = Math.max(1, ...sorted.map((item) => item.count));

  return (
    <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1">
      {sorted.length > 0 ? (
        sorted.map((item, index) => (
          <div
            key={item.label}
            className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-[10px] text-[#71829B]">
              {item.count}
            </span>

            <motion.div
              initial={{ height: 0 }}
              animate={{
                height: `${(item.count / maximum) * 72}%`,
              }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-10 rounded-t-md"
              style={{
                backgroundColor:
                  CHART_COLORS[index % CHART_COLORS.length],
              }}
            />

            <span className="text-[10px] text-[#52647D]">
              {item.label}
            </span>
          </div>
        ))
      ) : (
        <p className="self-center text-sm text-[#71829B]">
          No blood group data available.
        </p>
      )}
    </div>
  );
}

// ==================================================
// ATTENDANCE RATE TREND GRAPH
// ==================================================

function AttendanceRateTrend({
  data,
}: {
  data: Array<{ label: string; rate: number }>;
}) {
  const width = 560;
  const height = 220;
  const left = 38;
  const right = 14;
  const top = 16;
  const bottom = 34;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = data.map((item, index) => ({
    x:
      data.length <= 1
        ? left + plotWidth / 2
        : left + (index / (data.length - 1)) * plotWidth,
    y:
      top +
      ((100 - Math.max(0, Math.min(100, item.rate))) / 100) *
        plotHeight,
    ...item,
  }));

  const line = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `M ${points[0].x} ${top + plotHeight} ${points
          .map((point) => `L ${point.x} ${point.y}`)
          .join(" ")} L ${points[points.length - 1].x} ${
          top + plotHeight
        } Z`
      : "";

  if (!data.length) {
    return (
      <p className="text-sm text-[#71829B]">
        No attendance trend data available.
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#71829B]">
          Daily attendance rate
        </span>

        <span
          className="rounded-md border px-2 py-1 text-xs text-[#52647D]"
          style={{ borderColor: "#E2EAF5" }}
        >
          Last 7 days
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label="Attendance rate trend for the last seven days"
      >
        <defs>
          <linearGradient
            id="attendanceTrendFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#8FB6DF"
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor="#8FB6DF"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = top + ((100 - tick) / 100) * plotHeight;

          return (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#CBD8E8"
                strokeOpacity="0.75"
                strokeDasharray="3 4"
              />

              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#71829B"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {points.length > 1 && (
          <path
            d={areaPath}
            fill="url(#attendanceTrendFill)"
          />
        )}

        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="#6F9FCF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#6F9FCF"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />

            <text
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#71829B"
            >
              {point.label}
            </text>

            <title>
              {`${point.label}: ${point.rate}% attendance`}
            </title>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center gap-2 text-xs text-[#71829B]">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "#6F9FCF" }}
        />
        Attendance rate
      </div>
    </div>
  );
}

// ==================================================
// MAIN DASHBOARD
// ==================================================

const Dashboard = () => {
  const { user, permissions } = useAuth();
  const role = user?.role ?? "employee";

  const [visibleProfiles, setVisibleProfiles] = useState<ProfileRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [onboardingDemographics, setOnboardingDemographics] = useState<
    OnboardingDemographicRecord[]
  >([]);
  const [personalKudos, setPersonalKudos] = useState<KudosRecord[]>([]);
  const [orgCounts, setOrgCounts] = useState<{
    totalEmployees: number;
    presentToday: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Organization-wide counts for employees (their own data scope is "own").
  useEffect(() => {
    if (!user || role !== "employee") {
      setOrgCounts(null);
      return;
    }

    let cancelled = false;
    fetchOrgDashboardCounts()
      .then((counts) => {
        if (!cancelled) setOrgCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setOrgCounts(null);
      });

    return () => {
      cancelled = true;
    };
  }, [role, user]);

  // ----------------------------------------------
  // LOAD DASHBOARD DATA
  // ----------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadDashboardData = async () => {
      if (!user) {
        setVisibleProfiles([]);
        setAttendanceRecords([]);
        setLeaveRecords([]);
        setOnboardingDemographics([]);
        setPersonalKudos([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const dashboardScope = getScopeForModule(
          permissions,
          "dashboard",
          "own",
        );

        const [
          profiles,
          attendance,
          leaves,
          demographics,
          kudos,
        ] = await Promise.all([
          fetchProfilesForScope(user, dashboardScope, {
            includeSelf:
              dashboardScope === "own" ||
              dashboardScope === "all",
            fallbackToDepartment: role === "manager",
          }),

          fetchAttendanceRecords(user, permissions),
          fetchLeaveRecords(user, permissions),
          // Don't let a failed headcount fetch blank the rest of the dashboard.
          fetchOnboardingDemographics().catch((error) => {
            console.error("Failed to load organization headcount:", error);
            return [];
          }),
          fetchPersonalKudos(user),
        ]);

        if (cancelled) return;

        setVisibleProfiles(profiles);
        setAttendanceRecords(attendance);
        setLeaveRecords(leaves);
        setOnboardingDemographics(demographics);
        setPersonalKudos(kudos);
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load dashboard data:", error);

        setVisibleProfiles([]);
        setAttendanceRecords([]);
        setLeaveRecords([]);
        setOnboardingDemographics([]);
        setPersonalKudos([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [permissions, role, user]);

  // ----------------------------------------------
  // DASHBOARD CALCULATIONS
  // ----------------------------------------------

  const today = getBusinessDateKey();

  const teamCount = useMemo(
    () =>
      visibleProfiles.filter((profile) => profile.id !== user?.id).length,
    [visibleProfiles, user?.id],
  );

  const todayAttendanceCount = useMemo(
    () =>
      attendanceRecords.filter(
        (record) => record.date === today && Boolean(record.checkIn),
      ).length,
    [attendanceRecords, today],
  );

  const pendingLeaves = useMemo(
    () =>
      leaveRecords.filter((record) => record.status === "Pending").length,
    [leaveRecords],
  );

  const approvedLeavesToday = useMemo(
    () =>
      leaveRecords.filter(
        (record) =>
          record.status === "Approved" &&
          record.from <= today &&
          record.to >= today,
      ).length,
    [leaveRecords, today],
  );

  const weeklyAttendance = useMemo(
    () => attendanceRecords.slice(0, 5),
    [attendanceRecords],
  );

  const pendingTeamLeaves = useMemo(
    () =>
      leaveRecords
        .filter((record) => record.status === "Pending")
        .slice(0, 4),
    [leaveRecords],
  );

  // Gender is limited to Male and Female.
  const genderData = useMemo(() => {
    const counts = { Male: 0, Female: 0 };

    onboardingDemographics.forEach(({ gender }) => {
      const value = gender?.trim().toLowerCase() ?? "";

      if (["male", "m"].includes(value)) counts.Male += 1;
      if (["female", "f"].includes(value)) counts.Female += 1;
    });

    return [
      { label: "Male", count: counts.Male },
      { label: "Female", count: counts.Female },
    ];
  }, [onboardingDemographics]);

  // Employee status contains only Present, Absent and On Leave.
  const employeeStatusData = useMemo(() => {
    const presentIds = new Set<string>();

    attendanceRecords.forEach((record) => {
      if (record.date === today && record.checkIn && record.userId) {
        presentIds.add(record.userId);
      }
    });

    const employeeCount = onboardingDemographics.length;
    const present = Math.min(
      employeeCount,
      presentIds.size,
    );
    const onLeaveIds = new Set(
      leaveRecords
        .filter(
          (record) =>
            record.status === "Approved" &&
            record.from <= today &&
            record.to >= today &&
            !presentIds.has(record.userId),
        )
        .map((record) => record.userId),
    );

    const onLeave = Math.min(
      Math.max(0, employeeCount - present),
      onLeaveIds.size,
    );

    const absent = Math.max(
      0,
      employeeCount - present - onLeave,
    );

    return [
      { label: "Present", count: present },
      { label: "Absent", count: absent },
      { label: "On Leave", count: onLeave },
    ];
  }, [
    attendanceRecords,
    leaveRecords,
    today,
    onboardingDemographics.length,
  ]);

  // Attendance rate for the last seven days.
  const attendanceRateTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${today}T12:00:00`);

      date.setDate(date.getDate() - (6 - index));

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const presentIds = new Set<string>();

      attendanceRecords.forEach((record) => {
        if (record.date === key && record.checkIn && record.userId) {
          presentIds.add(record.userId);
        }
      });

      return {
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        rate: onboardingDemographics.length
          ? Math.round(
              (Math.min(
                onboardingDemographics.length,
                presentIds.size,
              ) /
                onboardingDemographics.length) *
                100,
            )
          : 0,
      };
    });

    return days;
  }, [attendanceRecords, today, onboardingDemographics.length]);

  const roleTypeData = useMemo(
    () => countValues(onboardingDemographics.map((record) => record.role_type)),
    [onboardingDemographics],
  );

  const bloodGroupData = useMemo(
    () => countValues(onboardingDemographics.map((record) => record.blood_group)),
    [onboardingDemographics],
  );

  const departmentChartData = useMemo(
    () => countValues(onboardingDemographics.map((record) => record.department)),
    [onboardingDemographics],
  );

  // ----------------------------------------------
  // KPI CARDS
  // ----------------------------------------------

 
  // ----------------------------------------------
  // KPI CARDS
  // ----------------------------------------------

  const stats =
    role === "admin" || role === "hr"
      ? [
          {
            title: "Total Employees",
            value: onboardingDemographics.length,
            icon: Users,
          },
          {
            title: "Present Today",
            value: todayAttendanceCount,
            icon: UserCheck,
          },
          {
            title: "On Leave",
            value: approvedLeavesToday,
            icon: CalendarOff,
          },
          {
            title: "Pending Approvals",
            value: pendingLeaves,
            icon: ClipboardCheck,
          },
          {
            title: "Departments",
            value: departmentChartData.length,
            icon: Building2,
          },
        ]
      : [
          role === "employee"
            ? {
                title: "Total Employees",
                value: orgCounts?.totalEmployees ?? onboardingDemographics.length,
                icon: Users,
              }
            : {
                title: "Team Members",
                value: teamCount,
                icon: Users,
              },
          {
            title: "Present Today",
            value:
              role === "employee" && orgCounts
                ? orgCounts.presentToday
                : todayAttendanceCount,
            icon: UserCheck,
          },
          {
            title: "Pending Approvals",
            value: pendingLeaves,
            icon: ClipboardCheck,
          },
        ];



  // ----------------------------------------------
  // RENDER DASHBOARD
  // ----------------------------------------------

  return (
    <div
      className="dashboard-light-override min-h-screen w-full [&_h1]:!text-black"
      style={{ backgroundColor: "#FFFFFF", color: "#14264F", colorScheme: "light" }}
    >
      
      <PageWrapper title="Dashboard">
      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#E7EDF5] bg-white p-10 shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {(role === "admin" || role === "hr") && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#71829B]">
                HR Analytics &amp; Workforce Overview
              </p>

              <div className="flex items-center gap-2 text-xs text-[#71829B]">
                <Activity
                  className="h-4 w-4"
                  style={{ color: "#6F9FCF" }}
                />
                Workforce Summary
              </div>
            </div>
          )}

          {/* KPI CARDS */}

          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              role === "admin" ? "xl:grid-cols-5" : "lg:grid-cols-3"
            }`}
          >
            
{stats.map((stat, index) => {
  const Icon = stat.icon;

  const cardDetails: Record<
    string,
    {
      badge: string;
      description: string;
      iconColor: string;
      iconBg: string;
      badgeColor: string;
      badgeBg: string;
    }
  > = {
    "Total Employees": {
      badge: "↑ 12%",
      description: "Full organization scope",
      iconColor: "#3395FF",
      iconBg: "#E5F2FF",
      badgeColor: "#19A982",
      badgeBg: "#E1FAF2",
    },
    "Present Today": {
      badge: "↑ 5%",
      description: "Visible attendance records",
      iconColor: "#19C9A3",
      iconBg: "#E1FAF2",
      badgeColor: "#19A982",
      badgeBg: "#E1FAF2",
    },
    "On Leave": {
      badge: "− 0%",
      description: "Approved leave count",
      iconColor: "#FF5B91",
      iconBg: "#FFEDF3",
      badgeColor: "#59708F",
      badgeBg: "#F0F5FC",
    },
    "Pending Approvals": {
      badge: "↑ 20%",
      description: "Leave workflow queue",
      iconColor: "#FF8048",
      iconBg: "#FFF0E6",
      badgeColor: "#FF5B78",
      badgeBg: "#FFEDF3",
    },
    Departments: {
      badge: "↑ 6%",
      description: "Configured org units",
      iconColor: "#9275FF",
      iconBg: "#F0EBFF",
      badgeColor: "#19A982",
      badgeBg: "#E1FAF2",
    },
  };

  const details = cardDetails[stat.title];

  return (
    <motion.div
      key={stat.title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="min-w-0 rounded-2xl border border-[#E3EAF5] bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: details?.iconBg ?? "#E5F2FF",
            color: details?.iconColor ?? "#3395FF",
          }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {(role === "admin" || role === "hr") && (
          <span
            className="whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{
              color: details.badgeColor,
              backgroundColor: details.badgeBg,
            }}
          >
            {details.badge}
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-[11px] font-medium text-[#59708F]">
        {stat.title.toUpperCase()}
      </p>

      <p className="mt-1 text-3xl font-bold leading-tight text-[#102653]">
        {stat.value}
      </p>

      <p className="mt-1 truncate text-[10px] text-[#7185A3]">
        {details?.description ?? "Current reporting period"}
      </p>
    </motion.div>
  );
})}

          </div>

          {/* ADMIN ANALYTICS */}

          {(role === "admin" || role === "hr") && (
            <div className="mt-6 space-y-6">
              {/* GENDER, ROLE TYPE AND BLOOD GROUP */}

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <ChartCard title="Gender Distribution" icon={Users}>
                  <DonutChart
                    data={genderData}
                    total={genderData.reduce(
                      (sum, item) => sum + item.count,
                      0,
                    )}
                  />
                </ChartCard>

                <ChartCard
                  title="Role Type Distribution"
                  icon={BriefcaseBusiness}
                >
                  <DonutChart
                    data={roleTypeData}
                    total={onboardingDemographics.length}
                  />
                </ChartCard>

                <ChartCard
                  title="Blood Group Distribution"
                  icon={Droplet}
                >
                  <BloodGroupChart data={bloodGroupData} />
                </ChartCard>
              </div>

              {/* EMPLOYEE STATUS AND ATTENDANCE TREND */}

              <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
                <ChartCard title="Employee Status" icon={UserCheck}>
                  <DonutChart
                    data={employeeStatusData}
                    total={onboardingDemographics.length}
                  />
                </ChartCard>

                <ChartCard
                  title="Attendance Rate Trend"
                  icon={TrendingUp}
                >
                  <AttendanceRateTrend
                    data={attendanceRateTrend}
                  />
                </ChartCard>
              </div>

              {/* RECENT ACTIVITY LEFT / DEPARTMENT OVERVIEW RIGHT */}

              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="min-w-0 h-full rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-5 font-heading text-lg font-semibold text-[#14264F]">
                    ALERTS
                  </h3>

                  <div className="divide-y divide-[#E7EDF5]">
                    {attendanceRecords.slice(0, 2).map((record, index) => {
                      const details =
                        record as unknown as Record<string, unknown>;

                      const employeeName =
                        details.employeeName ??
                        details.employee_name ??
                        details.name ??
                        details.fullName ??
                        "Employee";

                      const checkIn = record.checkIn || "";

                      return (
                        <div
                          key={String(
                            details.id ??
                              `${record.date}-${checkIn}-${index}`,
                          )}
                          className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                        >
                          <p className="min-w-0 text-sm text-[#52647D]">
                            <span className="font-medium">
                              {String(employeeName)}
                            </span>{" "}
                            checked in on {record.date}
                          </p>

                          <span className="shrink-0 text-xs text-[#71829B]">
                            {checkIn || "Check-in recorded"}
                          </span>
                        </div>
                      );
                    })}

                    {leaveRecords.slice(0, 2).map((record, index) => (
                      <div
                        key={String(
                          record.id ??
                            `${record.employeeName}-${record.from}-${index}`,
                        )}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 last:pb-0"
                      >
                        <p className="min-w-0 text-sm text-[#52647D]">
                          <span className="font-medium">
                            {record.employeeName}
                          </span>{" "}
                          leave request is{" "}
                          {String(record.status).toLowerCase()}
                        </p>

                        <span className="shrink-0 text-xs text-[#71829B]">
                          {record.from} to {record.to}
                        </span>
                      </div>
                    ))}

                    {attendanceRecords.length === 0 &&
                      leaveRecords.length === 0 && (
                        <p className="py-3 text-sm text-[#71829B]">
                          No recent activity available.
                        </p>
                      )}
                  </div>
                </motion.section>

                <ChartCard
                  title="DEPARTMENT_OVERVIEW"
                  icon={Building2}
                >
                  <HorizontalBarChart
                    data={departmentChartData}
                  />
                </ChartCard>
              </div>
            </div>
          )}

          {/* EMPLOYEE / MANAGER / HR SECTIONS */}

          {role !== "admin" && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {(role === "employee" || role === "manager") && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-4 flex items-center gap-2 font-heading font-semibold text-[#14264F]">
                    <Star
                      className="h-4 w-4"
                      style={{ color: "#B69AF8" }}
                    />
                    KUDOS_CORNER
                  </h3>

                  <div className="space-y-3">
                    {personalKudos.length > 0 ? (
                      personalKudos.map((kudos) => (
                        <div
                          key={kudos.id}
                          className="space-y-1 rounded-lg border border-[#E7EDF5] bg-[#F5F9FD] p-3"
                        >
                          <p className="font-heading text-xs tracking-wider text-primary">
                            {kudos.fromName} ({kudos.fromRole})
                          </p>

                          <p className="text-sm italic text-[#52647D]">
                            "{kudos.message}"
                          </p>

                          <p className="text-xs text-[#71829B]">
                            {new Date(kudos.createdAt)
                              .toISOString()
                              .split("T")[0]}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#71829B]">
                        No personal kudos are available yet.
                      </p>
                    )}
                  </div>
                </motion.section>
              )}

              {role === "hr" && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-4 flex items-center gap-2 font-heading font-semibold text-[#14264F]">
                    <Bell
                      className="h-4 w-4"
                      style={{ color: "#B69AF8" }}
                    />
                    RECENT_NOTIFICATIONS
                  </h3>

                  <div className="space-y-3">
                    {leaveRecords.slice(0, 4).map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-3 border-b border-[#E7EDF5] py-2 last:border-0"
                      >
                        <span className="text-sm text-[#52647D]">
                          {record.employeeName} requested {record.type}
                        </span>

                        <span className="text-xs text-[#71829B]">
                          {record.status}
                        </span>
                      </div>
                    ))}

                    {!leaveRecords.length && (
                      <p className="text-sm text-[#71829B]">
                        No operational notifications are available.
                      </p>
                    )}
                  </div>
                </motion.section>
              )}

          {/*    {role === "hr" && (
                <ChartCard
                  title="Department Overview"
                  icon={Building2}
                >
                  <HorizontalBarChart
                    data={departmentChartData}
                  />
                </ChartCard>
              )}*/}

              {role === "employee" && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-4 font-heading font-semibold text-[#14264F]">
                    WEEKLY_SUMMARY
                  </h3>

                  <div className="mb-4 rounded-lg border border-[#E7EDF5] bg-[#F8FAFD] px-4 py-3">
                    <p className="font-heading text-[10px] tracking-[0.2em] text-[#71829B]">
                      REPORTING_MANAGER
                    </p>

                    <p className="mt-1 text-sm text-[#52647D]">
                      {user?.reportingManagerName ?? "Not assigned yet"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {weeklyAttendance.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7EDF5] py-2 last:border-0"
                      >
                        <span className="text-sm text-[#52647D]">
                          {record.date}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${
                            record.status === "Full Day"
                              ? "status-approved"
                              : record.status === "Half Day" ||
                                  record.status === "Pending"
                                ? "status-pending"
                                : "status-rejected"
                          }`}
                        >
                          {record.status}
                        </span>

                        <span className="text-xs text-[#71829B]">
                          {record.checkIn ?? "-"} - {record.checkOut ?? "-"}
                        </span>
                      </div>
                    ))}

                    {!weeklyAttendance.length && (
                      <p className="text-sm text-[#71829B]">
                        No recent attendance data is available.
                      </p>
                    )}
                  </div>
                </motion.section>
              )}

              {role === "manager" && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#E7EDF5] bg-white p-6 shadow-sm"
                >
                  <h3 className="mb-4 font-heading font-semibold text-[#14264F]">
                    TEAM_LEAVE_REQUESTS
                  </h3>

                  <div className="space-y-3">
                    {pendingTeamLeaves.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between gap-3 border-b border-[#E7EDF5] py-2 last:border-0"
                      >
                        <div>
                          <span className="text-sm text-[#52647D]">
                            {request.employeeName}
                          </span>

                          <p className="text-xs text-[#71829B]">
                            {request.type} - {request.from} to {request.to}
                          </p>
                        </div>

                        <span className="status-pending rounded-full border px-2 py-1 text-xs">
                          {request.status}
                        </span>
                      </div>
                    ))}

                    {!pendingTeamLeaves.length && (
                      <p className="text-sm text-[#71829B]">
                        No pending team leave requests are visible.
                      </p>
                    )}
                  </div>
                </motion.section>
              )}
            </div>
          )}
        </>
      )}
      </PageWrapper>
    </div>
  );
};

export default Dashboard;
