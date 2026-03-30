import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchPayrollRecords, type PayrollRecord } from "@/lib/hrms-api";
import { hasMinimumDataScope } from "@/lib/permissions";

const formatCurrency = (amount: number) => `Rs.${Math.abs(amount).toLocaleString()}`;

const Payroll = () => {
  const { user, permissions } = useAuth();
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleDownloadPayslip = (payslipUrl: string | null) => {
    if (!payslipUrl) {
      return;
    }

    try {
      const resolvedUrl = new URL(payslipUrl, window.location.origin);
      const isExternalFile = resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:";

      if (!isExternalFile || resolvedUrl.origin === window.location.origin) {
        toast({
          title: "Invalid payslip link",
          description: "This payroll row needs a full public file URL, such as an https:// link to a PDF.",
          variant: "destructive",
        });
        return;
      }

      window.open(resolvedUrl.toString(), "_blank", "noopener,noreferrer");
    } catch {
      toast({
        title: "Invalid payslip link",
        description: "This payroll row needs a valid public file URL before the PDF can open.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadPayroll = async () => {
      if (!user) {
        setPayrollHistory([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const rows = await fetchPayrollRecords(user, permissions);
        setPayrollHistory(rows);
      } catch (error) {
        console.error("Failed to load payroll records:", error);
        setPayrollHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPayroll();
  }, [permissions, user]);

  const latestPayroll = payrollHistory[0] ?? null;
  const aggregateTotals = useMemo(
    () =>
      payrollHistory.reduce(
        (accumulator, record) => {
          accumulator.gross += record.gross;
          accumulator.deductions += record.deductions;
          accumulator.net += record.net;
          return accumulator;
        },
        { gross: 0, deductions: 0, net: 0 },
      ),
    [payrollHistory],
  );

  const showEmployeeColumn = hasMinimumDataScope(permissions, "payroll", "organization");

  return (
    <PageWrapper label="PAYROLL_SYSTEM" title="Compensation Overview">
      {isLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-foreground tracking-wide">
                {showEmployeeColumn ? "PAYROLL_SNAPSHOT" : "SALARY_BREAKDOWN"}
              </h3>
              <span className="text-xs text-primary font-heading tracking-wider">
                {latestPayroll?.month ?? "NO_RECORDS"}
              </span>
            </div>
            {latestPayroll ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-sm text-foreground/80">Gross Pay</span>
                  <span className="text-sm font-heading text-foreground">{formatCurrency(latestPayroll.gross)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-sm text-foreground/80">Deductions</span>
                  <span className="text-sm font-heading text-red-400">-{formatCurrency(latestPayroll.deductions)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-sm text-foreground/80">Net Pay</span>
                  <span className="text-sm font-heading text-primary">{formatCurrency(latestPayroll.net)}</span>
                </div>
                {showEmployeeColumn && (
                  <>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-sm text-foreground/80">Visible Gross Total</span>
                      <span className="text-sm font-heading text-foreground">{formatCurrency(aggregateTotals.gross)}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t border-primary/30">
                      <span className="font-heading font-semibold text-foreground">VISIBLE NET TOTAL</span>
                      <span className="font-heading font-bold text-primary text-lg">{formatCurrency(aggregateTotals.net)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border/30 bg-muted/20 p-6 text-sm text-muted-foreground">
                No payroll records are visible with your current access scope.
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6 space-y-4"
          >
            <h3 className="font-heading font-semibold text-foreground tracking-wide">PAYSLIP_ARCHIVE</h3>
            <div className="space-y-3">
              {payrollHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/30"
                >
                  <div>
                    <p className="text-sm font-heading text-foreground">{record.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {showEmployeeColumn ? `${record.employeeName} - ` : ""}Net: {formatCurrency(record.net)}
                    </p>
                  </div>
                  <GlowButton
                    variant="ghost"
                    className="flex items-center gap-2"
                    disabled={!record.payslipUrl}
                    onClick={() => handleDownloadPayslip(record.payslipUrl)}
                  >
                    <Download className="w-4 h-4" /> PDF
                  </GlowButton>
                </div>
              ))}
              {!payrollHistory.length && (
                <div className="rounded-lg border border-border/30 bg-muted/20 p-6 text-sm text-muted-foreground">
                  Payslip history will appear here once payroll records are available from Supabase.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
};

export default Payroll;
