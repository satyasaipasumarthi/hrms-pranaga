import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GlowButton from "@/components/ui/GlowButton";
import PageWrapper from "@/components/ui/PageWrapper";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAccessGrants,
  fetchAssignableManagers,
  inviteUserWithRole,
  type AccessGrantRecord,
  type ManagerOption,
} from "@/lib/hrms-api";
import { hasModulePermission } from "@/lib/permissions";
import { assignableRoles, formatRoleLabel, type AssignableRole } from "@/lib/roles";

const roleContent: Record<AssignableRole, { summary: string; scope: string; accent: string }> = {
  employee: {
    summary: "Own-service access for daily HR tasks like attendance, leave, payroll, and performance.",
    scope: "Own records only",
    accent: "border-border/50 bg-muted/30",
  },
  manager: {
    summary: "Team lead access for approvals, attendance oversight, and performance visibility for direct reports.",
    scope: "Team scope",
    accent: "border-secondary/30 bg-secondary/10",
  },
  hr: {
    summary: "HR access across the organization for people operations, recruitment, and workforce records.",
    scope: "Organization scope",
    accent: "border-primary/30 bg-primary/10",
  },
};

const defaultForm = {
  name: "",
  email: "",
  role: "employee" as AssignableRole,
  department: "Operations",
  reportingManagerId: "",
};

const formatInviteDate = (value: string) => {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AccessControl = () => {
  const { user, permissions } = useAuth();
  const canManageAccess = hasModulePermission(permissions, "access_control", "view");
  const [form, setForm] = useState(defaultForm);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [grants, setGrants] = useState<AccessGrantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadAccessData = async () => {
      if (!user || !canManageAccess) {
        setManagers([]);
        setGrants([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [managerRows, grantRows] = await Promise.all([
          fetchAssignableManagers(),
          fetchAccessGrants(),
        ]);
        setManagers(managerRows);
        setGrants(grantRows);
      } catch (error) {
        console.error("Failed to load access-control data:", error);
        toast({
          title: "Access data unavailable",
          description: error instanceof Error ? error.message : "We could not load access-control details.",
          variant: "destructive",
        });
        setManagers([]);
        setGrants([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAccessData();
  }, [canManageAccess, user]);

  if (!user || !canManageAccess) {
    return (
      <PageWrapper label="ACCESS_DENIED" title="Unauthorized">
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Only administrators can grant access to new users.</p>
        </div>
      </PageWrapper>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await inviteUserWithRole({
        name: form.name,
        email: form.email,
        role: form.role,
        department: form.department,
        reportingManagerId: form.role === "employee" && form.reportingManagerId ? form.reportingManagerId : null,
      });

      const refreshedGrants = await fetchAccessGrants();
      setGrants(refreshedGrants);
      setForm(defaultForm);

      toast({
        title: "Invitation sent",
        description: response?.message ?? "The new user has been granted access and invited by email.",
      });
    } catch (error) {
      console.error("Failed to invite user:", error);
      toast({
        title: "Invitation failed",
        description: error instanceof Error ? error.message : "The access grant could not be completed.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper label="ACCESS_CONTROL" title="Grant Role-Based Access">
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 space-y-4"
          >
            <div className="space-y-2">
              <p className="section-label">ACCESS_PLAYBOOK</p>
              <h2 className="text-xl font-heading text-foreground">Invite new employees with the right role from day one</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                This page is intentionally limited to `manager`, `hr`, and `employee`. Admin access remains unchanged and cannot be granted here.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {assignableRoles.map((role) => (
                <div key={role} className={`rounded-xl border p-4 space-y-2 ${roleContent[role].accent}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-heading text-sm text-foreground">{formatRoleLabel(role)}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{roleContent[role].scope}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{roleContent[role].summary}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onSubmit={handleSubmit}
            className="glass-card p-6 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">FULL_NAME</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="New team member"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">WORK_EMAIL</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">ROLE</label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as AssignableRole,
                      reportingManagerId: event.target.value === "employee" ? current.reportingManagerId : "",
                    }))
                  }
                  className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">DEPARTMENT</label>
                <input
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="Operations"
                  required
                />
              </div>
            </div>

            {form.role === "employee" && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">REPORTING_MANAGER</label>
                <select
                  value={form.reportingManagerId}
                  onChange={(event) => setForm((current) => ({ ...current, reportingManagerId: event.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value="">No manager assigned yet</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Assigning a reporting manager keeps the org hierarchy visible immediately, even before that person gets portal access.
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                The invitation will create the user in Supabase Auth, stamp the selected role, and make the new permissions available at login.
              </p>
              <GlowButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending invite..." : "Grant Access"}
              </GlowButton>
            </div>
          </motion.form>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 space-y-4"
        >
          <div className="space-y-1">
            <p className="section-label">RECENT_GRANTS</p>
            <h2 className="text-xl font-heading text-foreground">Latest invitations</h2>
            <p className="text-sm text-muted-foreground">
              Track who was invited, which role was assigned, and how often the invite was sent.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : grants.length ? (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div key={grant.id} className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm text-foreground">{grant.name}</p>
                      <p className="text-xs text-muted-foreground">{grant.email}</p>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-heading uppercase tracking-[0.2em] text-primary">
                      {formatRoleLabel(grant.role)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>Department: <span className="text-foreground/80">{grant.department ?? "Unassigned"}</span></p>
                    <p>Reporting manager: <span className="text-foreground/80">{grant.reportingManagerName ?? "Not assigned"}</span></p>
                    <p>Invite count: <span className="text-foreground/80">{grant.inviteCount}</span></p>
                    <p>Last invited: <span className="text-foreground/80">{formatInviteDate(grant.lastInvitedAt)}</span></p>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Granted by {grant.grantedByName ?? "Admin"} {grant.authUserId ? "and provisioned in Auth" : "pending Auth linkage"}.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-8 text-center">
              <p className="text-sm text-muted-foreground">No access grants have been recorded yet.</p>
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default AccessControl;
