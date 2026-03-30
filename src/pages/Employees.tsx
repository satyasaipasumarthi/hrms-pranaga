import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import { useAuth } from "@/hooks/useAuth";
import { fetchVisibleEmployees, type ProfileRecord } from "@/lib/hrms-api";
import { canManageEmployees } from "@/lib/permissions";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";

const Employees = () => {
  const { user, permissions } = useAuth();
  const [employees, setEmployees] = useState<ProfileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!user || !canManageEmployees(permissions)) {
        setEmployees([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const rows = await fetchVisibleEmployees(user, permissions);
        setEmployees(rows);
      } catch (error) {
        console.error("Failed to load employees:", error);
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEmployees();
  }, [permissions, user]);

  if (!user || !canManageEmployees(permissions)) {
    return (
      <PageWrapper label="ACCESS_DENIED" title="Unauthorized">
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">You do not have permission to view the personnel directory.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper label="PERSONNEL_DIRECTORY" title="Team Overview">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">NAME</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">EMAIL</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">DEPARTMENT</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">ROLE</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, index) => {
                  const normalizedRole = normalizeRole(employee.role);

                  return (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                            <span className="text-xs font-heading font-semibold text-primary">{employee.name[0]}</span>
                          </div>
                          <span className="text-foreground/90">{employee.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground/70">{employee.email}</td>
                      <td className="py-3 px-4 text-foreground/70">{employee.department ?? "Unassigned"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            normalizedRole === "admin"
                              ? "text-primary bg-primary/10 border-primary/30"
                              : normalizedRole === "manager"
                                ? "text-secondary bg-secondary/10 border-secondary/30"
                                : "text-muted-foreground bg-muted/50 border-border/50"
                          }`}
                        >
                          {normalizedRole ? formatRoleLabel(normalizedRole) : employee.role}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
                {!employees.length && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      No employee records are visible for your current access scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </PageWrapper>
  );
};

export default Employees;
