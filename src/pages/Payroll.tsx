import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchPayrollRecords, type PayrollRecord } from "@/lib/hrms-api";
import { hasMinimumDataScope } from "@/lib/permissions";

const formatCurrency = (amount: number) =>
  `Rs.${Math.abs(amount).toLocaleString()}`;

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
      const isExternalFile =
        resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:";

      if (!isExternalFile || resolvedUrl.origin === window.location.origin) {
        toast({
          title: "Invalid payslip link",
          description:
            "This payroll row needs a full public file URL, such as an https:// link to a PDF.",
          variant: "destructive",
        });
        return;
      }

      window.open(resolvedUrl.toString(), "_blank", "noopener,noreferrer");
    } catch {
      toast({
        title: "Invalid payslip link",
        description:
          "This payroll row needs a valid public file URL before the PDF can open.",
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

  const showEmployeeColumn = hasMinimumDataScope(
    permissions,
    "payroll",
    "organization",
  );

  return (
    <div
      className="dashboard-light-override min-h-screen w-full"
      style={{
        backgroundColor: "#FFFFFF",
        color: "#000000",
        colorScheme: "light",
      }}
    >
      <style>{`
        body:has(.dashboard-light-override),
        body:has(.dashboard-light-override) #root {
          background: #FFFFFF !important;
          background-color: #FFFFFF !important;
        }
        .dashboard-light-override,
        .dashboard-light-override > div {
          background: #FFFFFF !important;
          background-color: #FFFFFF !important;
          color: #000000 !important;
          color-scheme: light !important;
          min-height: 100vh;
        }
        .dashboard-light-override,
        .dashboard-light-override main,
        .dashboard-light-override [data-page-wrapper] {
          background-color: #FFFFFF !important;
          color-scheme: light !important;
        }
        .dashboard-light-override .text-foreground,
        .dashboard-light-override h1,
        .dashboard-light-override h2,
        .dashboard-light-override h3,
        .dashboard-light-override h4 {
          color: #000000 !important;
        }
        .dashboard-light-override .text-muted-foreground {
          color: #111111 !important;
          opacity: 0.75;
        }
        .dashboard-light-override .glass-card {
          background: #FFFFFF !important;
          border: 1px solid #FF8A00 !important;
          box-shadow: 0 4px 14px rgba(255, 69, 0, 0.08) !important;
          border-radius: 1rem;
        }
      `}</style>

      <PageWrapper label="PAYROLL_SYSTEM" title="Compensation Overview">
        {isLoading ? (
          <div className="glass-card p-10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#FF4500] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-black tracking-wide">
                  {showEmployeeColumn ? "PAYROLL_SNAPSHOT" : "SALARY_BREAKDOWN"}
                </h3>
                <span className="text-xs text-[#FF4500] font-heading font-bold tracking-wider">
                  {latestPayroll?.month ?? "NO_RECORDS"}
                </span>
              </div>

              {latestPayroll ? (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-[#FF8A00]/20">
                    <span className="text-sm text-black">Gross Pay</span>
                    <span className="text-sm font-heading font-semibold text-black">
                      {formatCurrency(latestPayroll.gross)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#FF8A00]/20">
                    <span className="text-sm text-black">Deductions</span>
                    <span className="text-sm font-heading font-semibold text-[#FF4500]">
                      -{formatCurrency(latestPayroll.deductions)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#FF8A00]/20">
                    <span className="text-sm text-black">Net Pay</span>
                    <span className="text-sm font-heading font-bold text-[#FF4500]">
                      {formatCurrency(latestPayroll.net)}
                    </span>
                  </div>
                  {showEmployeeColumn && (
                    <>
                      <div className="flex justify-between py-2 border-b border-[#FF8A00]/20">
                        <span className="text-sm text-black">
                          Visible Gross Total
                        </span>
                        <span className="text-sm font-heading font-semibold text-black">
                          {formatCurrency(aggregateTotals.gross)}
                        </span>
                      </div>
                      <div className="flex justify-between py-3 border-t border-[#FF4500]/40">
                        <span className="font-heading font-semibold text-black">
                          VISIBLE NET TOTAL
                        </span>
                        <span className="font-heading font-bold text-[#FF4500] text-lg">
                          {formatCurrency(aggregateTotals.net)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[#FF8A00]/30 bg-white p-6 text-sm text-black">
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
              <h3 className="font-heading font-semibold text-black tracking-wide">
                PAYSLIP_ARCHIVE
              </h3>
              <div className="space-y-3">
                {payrollHistory.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white border border-[#FF8A00]/40 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-heading font-semibold text-black">
                        {record.month}
                      </p>
                      <p className="text-xs text-black/80 font-medium">
                        {showEmployeeColumn ? `${record.employeeName} - ` : ""}
                        Net: {formatCurrency(record.net)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!record.payslipUrl}
                      onClick={() => handleDownloadPayslip(record.payslipUrl)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#FF4500] hover:bg-[#FF8A00] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Download className="w-4 h-4 text-white" /> PDF
                    </button>
                  </div>
                ))}
                {!payrollHistory.length && (
                  <div className="rounded-lg border border-[#FF8A00]/30 bg-white p-6 text-sm text-black">
                    Payslip history will appear here once payroll records are
                    available from Supabase.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </PageWrapper>
    </div>
  );
};

export default Payroll;
