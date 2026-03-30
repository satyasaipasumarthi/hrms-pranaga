import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import { fetchRecruitmentCandidates, type RecruitmentCandidateRecord } from "@/lib/hrms-api";

const stages = ["New", "Shortlisted", "Interview", "Selected", "Rejected"] as const;

const stageColors: Record<(typeof stages)[number], string> = {
  New: "border-secondary/40 bg-secondary/5",
  Shortlisted: "border-yellow-400/40 bg-yellow-400/5",
  Interview: "border-primary/40 bg-primary/5",
  Selected: "border-green-400/40 bg-green-400/5",
  Rejected: "border-red-400/40 bg-red-400/5",
};

const stageDotColors: Record<(typeof stages)[number], string> = {
  New: "bg-secondary",
  Shortlisted: "bg-yellow-400",
  Interview: "bg-primary",
  Selected: "bg-green-400",
  Rejected: "bg-red-400",
};

const Recruitment = () => {
  const [candidates, setCandidates] = useState<RecruitmentCandidateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCandidates = async () => {
      setIsLoading(true);

      try {
        const rows = await fetchRecruitmentCandidates();
        setCandidates(rows);
      } catch (error) {
        console.error("Failed to load recruitment pipeline:", error);
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCandidates();
  }, []);

  const groupedCandidates = useMemo(
    () =>
      stages.reduce<Record<(typeof stages)[number], RecruitmentCandidateRecord[]>>((accumulator, stage) => {
        accumulator[stage] = candidates.filter((candidate) => candidate.stage === stage);
        return accumulator;
      }, { New: [], Shortlisted: [], Interview: [], Selected: [], Rejected: [] }),
    [candidates],
  );

  return (
    <PageWrapper label="RECRUITMENT_PIPELINE" title="Talent Acquisition">
      {isLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stages.map((stage, stageIndex) => (
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stageIndex * 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stageDotColors[stage]}`} />
                <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase">{stage}</h4>
                <span className="text-xs text-muted-foreground">({groupedCandidates[stage].length})</span>
              </div>
              <div className="space-y-2">
                {groupedCandidates[stage].map((candidate) => (
                  <motion.div
                    key={candidate.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-lg border ${stageColors[stage]} transition-all cursor-pointer`}
                  >
                    <p className="text-sm font-heading text-foreground">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{candidate.position}</p>
                  </motion.div>
                ))}
                {!groupedCandidates[stage].length && (
                  <div className="p-4 rounded-lg border border-border/30 bg-muted/20 text-xs text-muted-foreground">
                    No candidates in this stage.
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageWrapper>
  );
};

export default Recruitment;
