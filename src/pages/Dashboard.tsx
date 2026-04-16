import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, CalendarOff, ClipboardCheck, Star, UserCheck, Users } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import PageWrapper from "@/components/ui/PageWrapper";
import { useAuth } from "@/hooks/useAuth";
import { getBusinessDateKey } from "@/lib/attendance";
import {
  fetchAttendanceRecords,
  fetchDepartmentCounts,
  fetchLeaveRecords,
  fetchPersonalKudos,
  fetchProfilesForScope,
  type AttendanceRecord,
  type KudosRecord,
  type LeaveRecord,
  type ProfileRecord,
} from "@/lib/hrms-api";
import { getScopeForModule } from "@/lib/hrms-api";

const Dashboard = () => {
  const { user, permissions } = useAuth();
  const role = user?.role ?? "employee";
  const [visibleProfiles, setVisibleProfiles] = useState<ProfileRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [personalKudos, setPersonalKudos] = useState<KudosRecord[]>([]);
  const [departmentCounts, setDepartmentCounts] = useState<Array<{ department: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) {
        setVisibleProfiles([]);
        setAttendanceRecords([]);
        setLeaveRecords([]);
        setPersonalKudos([]);
        setDepartmentCounts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const dashboardScope = getScopeForModule(permissions, "dashboard", "own");
        const [profiles, attendance, leaves, kudos, departments] = await Promise.all([
          fetchProfilesForScope(user, dashboardScope, {
            includeSelf: dashboardScope === "own" || dashboardScope === "all",
            fallbackToDepartment: role === "manager",
          }),
          fetchAttendanceRecords(user, permissions),
          fetchLeaveRecords(user, permissions),
          fetchPersonalKudos(user),
          role === "hr" || role === "admin" ? fetchDepartmentCounts(user, permissions) : Promise.resolve([]),
        ]);

        setVisibleProfiles(profiles);
        setAttendanceRecords(attendance);
        setLeaveRecords(leaves);
        setPersonalKudos(kudos);
        setDepartmentCounts(departments);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        setVisibleProfiles([]);
        setAttendanceRecords([]);
        setLeaveRecords([]);
        setPersonalKudos([]);
        setDepartmentCounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboardData();
  }, [permissions, role, user]);

  const today = getBusinessDateKey();
  const teamCount = useMemo(() => visibleProfiles.filter((profile) => profile.id !== user?.id).length, [user?.id, visibleProfiles]);
  const todayAttendanceCount = useMemo(
    () => attendanceRecords.filter((record) => record.date === today && Boolean(record.checkIn)).length,
    [attendanceRecords, today],
  );
  const pendingLeaves = useMemo(
    () => leaveRecords.filter((record) => record.status === "Pending").length,
    [leaveRecords],
  );
  const approvedLeavesToday = useMemo(
    () => leaveRecords.filter((record) => record.status === "Approved" && record.from <= today && record.to >= today).length,
    [leaveRecords, today],
  );
  const weeklyAttendance = useMemo(() => attendanceRecords.slice(0, 5), [attendanceRecords]);
  const pendingTeamLeaves = useMemo(
    () => leaveRecords.filter((record) => record.status === "Pending").slice(0, 4),
    [leaveRecords],
  );
  const recentActivity = useMemo(
    () => [
      ...attendanceRecords.slice(0, 2).map((record) => ({
        text: `${record.employeeName} checked in on ${record.date}`,
        time: record.checkIn ?? "--",
      })),
      ...leaveRecords.slice(0, 2).map((record) => ({
        text: `${record.employeeName} leave request is ${record.status.toLowerCase()}`,
        time: `${record.from} to ${record.to}`,
      })),
    ],
    [attendanceRecords, leaveRecords],
  );

  const stats = useMemo(() => {
    if (role === "employee") {
      return [
        { title: "Weekly Attendance", value: weeklyAttendance.length, icon: UserCheck, suffix: "/ 5 entries" },
        { title: "Pending Leaves", value: pendingLeaves, icon: CalendarOff, trend: "Awaiting approval" },
        { title: "Kudos Received", value: personalKudos.length, icon: Star, trend: "Recognition just for you" },
      ];
    }

    if (role === "manager") {
      return [
        { title: "Team Members", value: teamCount, icon: Users, trend: "Direct reports in scope" },
        { title: "Pending Leaves", value: pendingLeaves, icon: CalendarOff, trend: "Awaiting manager action" },
        { title: "Present Today", value: todayAttendanceCount, icon: UserCheck, trend: "Visible team attendance" },
      ];
    }

    if (role === "hr") {
      return [
        { title: "Active Employees", value: visibleProfiles.length, icon: Users, trend: "Operational directory scope" },
        { title: "Pending Leaves", value: pendingLeaves, icon: CalendarOff, trend: "Organization requests" },
        { title: "Present Today", value: todayAttendanceCount, icon: UserCheck, trend: "Organization attendance" },
      ];
    }

    return [
      { title: "Total Employees", value: visibleProfiles.length, icon: Users, trend: "Full organization scope" },
      { title: "Present Today", value: todayAttendanceCount, icon: UserCheck, trend: "Visible attendance records" },
      { title: "On Leave", value: approvedLeavesToday, icon: CalendarOff },
      { title: "Pending Approvals", value: pendingLeaves, icon: ClipboardCheck, trend: "Leave workflow queue" },
      { title: "Departments", value: departmentCounts.length, icon: AlertTriangle, trend: "Configured org units" },
    ];
  }, [approvedLeavesToday, departmentCounts.length, pendingLeaves, personalKudos.length, role, todayAttendanceCount, teamCount, visibleProfiles.length, weeklyAttendance.length]);

  return (
    <PageWrapper label="SYSTEM_STATUS" title="Pulse Dashboard">
      {isLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${role === "admin" ? "xl:grid-cols-5" : "xl:grid-cols-3"} gap-4`}>
            {stats.map((stat, index) => (
              <StatCard key={stat.title} {...stat} delay={index * 0.1} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            {(role === "employee" || role === "manager") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" /> KUDOS_CORNER
                </h3>
                <div className="space-y-3">
                  {personalKudos.length > 0 ? (
                    personalKudos.map((kudos) => (
                      <div key={kudos.id} className="p-3 rounded-lg bg-muted/50 border border-border/30 space-y-1">
                        <p className="text-xs text-primary font-heading tracking-wider">
                          {kudos.fromName} ({kudos.fromRole})
                        </p>
                        <p className="text-sm text-foreground/80 italic">"{kudos.message}"</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(kudos.createdAt).toISOString().split("T")[0]}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No personal kudos are available yet.</p>
                  )}
                </div>
              </motion.div>
            )}

            {role === "admin" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">RECENT_ACTIVITY</h3>
                <div className="space-y-3">
                  {recentActivity.map((item, index) => (
                    <div key={`${item.text}-${index}`} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground/80">{item.text}</span>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                  ))}
                  {!recentActivity.length && <p className="text-sm text-muted-foreground">No recent activity is available.</p>}
                </div>
              </motion.div>
            )}

            {role === "hr" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" /> RECENT_NOTIFICATIONS
                </h3>
                <div className="space-y-3">
                  {leaveRecords.slice(0, 4).map((record) => (
                    <div key={record.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground/80">
                        {record.employeeName} requested {record.type}
                      </span>
                      <span className="text-xs text-muted-foreground">{record.status}</span>
                    </div>
                  ))}
                  {!leaveRecords.length && <p className="text-sm text-muted-foreground">No operational notifications are available.</p>}
                </div>
              </motion.div>
            )}

            {(role === "admin" || role === "hr") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">DEPARTMENT_OVERVIEW</h3>
                <div className="space-y-4">
                  {departmentCounts.map((department) => (
                    <div key={department.department} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground/80">{department.department}</span>
                        <span className="text-muted-foreground">{department.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(department.count / Math.max(visibleProfiles.length, 1)) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.7 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </div>
                  ))}
                  {!departmentCounts.length && <p className="text-sm text-muted-foreground">No department data is available.</p>}
                </div>
              </motion.div>
            )}

            {role === "employee" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">WEEKLY_SUMMARY</h3>
                <div className="mb-4 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                  <p className="text-[10px] font-heading tracking-[0.2em] text-muted-foreground">REPORTING_MANAGER</p>
                  <p className="mt-1 text-sm text-foreground/85">{user?.reportingManagerName ?? "Not assigned yet"}</p>
                </div>
                <div className="space-y-3">
                  {weeklyAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-foreground/80">{record.date}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          record.status === "Full Day"
                            ? "status-approved"
                            : record.status === "Half Day" || record.status === "Pending"
                              ? "status-pending"
                              : "status-rejected"
                        }`}
                      >
                        {record.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {record.checkIn ?? "-"} - {record.checkOut ?? "-"}
                      </span>
                    </div>
                  ))}
                  {!weeklyAttendance.length && <p className="text-sm text-muted-foreground">No recent attendance data is available.</p>}
                </div>
              </motion.div>
            )}

            {role === "manager" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass-card p-6"
              >
                <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">TEAM_LEAVE_REQUESTS</h3>
                <div className="space-y-3">
                  {pendingTeamLeaves.map((request) => (
                    <div key={request.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <span className="text-sm text-foreground/80">{request.employeeName}</span>
                        <p className="text-xs text-muted-foreground">
                          {request.type} - {request.from} to {request.to}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full border status-pending">{request.status}</span>
                    </div>
                  ))}
                  {!pendingTeamLeaves.length && <p className="text-sm text-muted-foreground">No pending team leave requests are visible.</p>}
                </div>
              </motion.div>
            )}
          </div>
        </>
      )}
    </PageWrapper>
  );
};

export default Dashboard;
