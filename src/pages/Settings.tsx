import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import { useAuth } from "@/hooks/useAuth";
import { fetchDepartmentCounts, fetchRoleCounts } from "@/lib/hrms-api";
import { canManageSettings } from "@/lib/permissions";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";

const Settings = () => {
  const { user, permissions } = useAuth();
  const [roleCounts, setRoleCounts] = useState<Array<{ role: string; count: number }>>([]);
  const [departmentCounts, setDepartmentCounts] = useState<Array<{ department: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettingsOverview = async () => {
      if (!user || !canManageSettings(permissions)) {
        setRoleCounts([]);
        setDepartmentCounts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [roles, departments] = await Promise.all([
          fetchRoleCounts(user, permissions),
          fetchDepartmentCounts(user, permissions),
        ]);

        setRoleCounts(roles);
        setDepartmentCounts(departments);
      } catch (error) {
        console.error("Failed to load settings overview:", error);
        setRoleCounts([]);
        setDepartmentCounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettingsOverview();
  }, [permissions, user]);

  return (
    <PageWrapper label="ADMIN_SETTINGS" title="System Configuration">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 space-y-4"
        >
          <h3 className="font-heading font-semibold text-foreground tracking-wide">ROLE_MANAGEMENT</h3>
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              roleCounts.map((roleCount) => {
                const normalizedRole = normalizeRole(roleCount.role);

                return (
                  <div key={roleCount.role} className="flex items-center justify-between py-2 border-b border-border/30">
                    <div>
                      <span className="text-sm text-foreground/80">
                        {normalizedRole ? formatRoleLabel(normalizedRole) : roleCount.role}
                      </span>
                      <p className="text-xs text-muted-foreground">Permissions are resolved from backend role metadata.</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {roleCount.count} users
                    </span>
                  </div>
                );
              })
            )}
            {!isLoading && !roleCounts.length && (
              <p className="text-sm text-muted-foreground">No role records are visible with the current backend scope.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 space-y-4"
        >
          <h3 className="font-heading font-semibold text-foreground tracking-wide">DEPARTMENT_MANAGEMENT</h3>
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              departmentCounts.map((department) => (
                <div
                  key={department.department}
                  className="flex items-center justify-between py-2 border-b border-border/30"
                >
                  <div>
                    <span className="text-sm text-foreground/80">{department.department}</span>
                    <p className="text-xs text-muted-foreground">Department visibility is filtered by backend scope.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{department.count} members</span>
                </div>
              ))
            )}
            {!isLoading && !departmentCounts.length && (
              <p className="text-sm text-muted-foreground">No department records are visible with the current backend scope.</p>
            )}
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Settings;
