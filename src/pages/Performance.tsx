import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchPerformanceRecords, getReadableErrorMessage, type PerformanceRecord } from "@/lib/hrms-api";

const CircularProgress = ({ value, size = 100 }: { value: number; size?: number }) => {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--primary))"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
        strokeDasharray={circumference}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-heading font-bold text-lg"
        transform={`rotate(90, ${size / 2}, ${size / 2})`}
      >
        {value}%
      </text>
    </svg>
  );
};

const Performance = () => {
  const { user, permissions } = useAuth();
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPerformance = async () => {
      if (!user) {
        setPerformanceRecords([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const rows = await fetchPerformanceRecords(user, permissions);
        setPerformanceRecords(rows);
      } catch (error) {
        console.error("Failed to load performance records:", error);
        setPerformanceRecords([]);
        toast({
          title: "Performance load issue",
          description: getReadableErrorMessage(error, "Unable to load performance records."),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadPerformance();
  }, [permissions, user]);

  const okrCards = useMemo(() => performanceRecords.slice(0, 3), [performanceRecords]);
  const feedbackCards = useMemo(() => performanceRecords.slice(0, 6), [performanceRecords]);

  return (
    <PageWrapper label="PERFORMANCE_METRICS" title="OKR Tracking">
      {isLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {okrCards.map((record, index) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                className="glass-card-glow p-6 flex flex-col items-center space-y-4"
              >
                <CircularProgress value={record.progress} />
                <h4 className="font-heading font-semibold text-foreground text-center">{record.objective}</h4>
                <p className="text-sm text-muted-foreground text-center">{record.employeeName}</p>
              </motion.div>
            ))}
            {!okrCards.length && (
              <div className="glass-card p-8 text-center text-muted-foreground md:col-span-3">
                No performance records are visible for your current access scope.
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6"
          >
            <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">360_FEEDBACK</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {feedbackCards.map((record, index) => (
                <div key={`${record.id}-${index}`} className="p-4 rounded-lg bg-muted/50 border border-border/30 space-y-2">
                  <p className="text-xs text-primary font-heading tracking-wider">{record.reviewerName}</p>
                  <p className="text-sm text-foreground/80 italic">"{record.summary}"</p>
                </div>
              ))}
              {!feedbackCards.length && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border/30 text-sm text-muted-foreground sm:col-span-2">
                  No review feedback is currently available from the backend.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </PageWrapper>
  );
};

export default Performance;
