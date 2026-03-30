import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import { useAuth } from "@/hooks/useAuth";
import { fetchTeamMembers, type ProfileRecord } from "@/lib/hrms-api";
import { hasModulePermission } from "@/lib/permissions";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";

const Team = () => {
  const { user, permissions } = useAuth();
  const [teamMembers, setTeamMembers] = useState<ProfileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTeam = async () => {
      if (!user || !hasModulePermission(permissions, "team", "view")) {
        setTeamMembers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const rows = await fetchTeamMembers(user, permissions);
        setTeamMembers(rows);
      } catch (error) {
        console.error("Failed to load team members:", error);
        setTeamMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTeam();
  }, [permissions, user]);

  return (
    <PageWrapper label="TEAM_DIRECTORY" title="My Team">
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
                {teamMembers.map((employee, index) => {
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
                        <span className="text-xs px-2 py-1 rounded-full border bg-muted/50 border-border/50 text-muted-foreground">
                          {normalizedRole ? formatRoleLabel(normalizedRole) : employee.role}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
                {!teamMembers.length && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      No team records are visible for your current access scope.
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

export default Team;
