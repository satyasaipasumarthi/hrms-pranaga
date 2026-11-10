import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import {
  fetchRecruitmentCandidates,
  type RecruitmentCandidateRecord,
} from "@/lib/hrms-api";

const stages = [
  "New",
  "Shortlisted",
  "Interview",
  "Selected",
  "Rejected",
] as const;

const Recruitment = () => {
  const [candidates, setCandidates] = useState<RecruitmentCandidateRecord[]>(
    [],
  );
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
      stages.reduce<
        Record<(typeof stages)[number], RecruitmentCandidateRecord[]>
      >(
        (accumulator, stage) => {
          accumulator[stage] = candidates.filter(
            (candidate) => candidate.stage === stage,
          );
          return accumulator;
        },
        { New: [], Shortlisted: [], Interview: [], Selected: [], Rejected: [] },
      ),
    [candidates],
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

      <PageWrapper label="RECRUITMENT_PIPELINE" title="Talent Acquisition">
        {isLoading ? (
          <div className="glass-card p-10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#FF4500] border-t-transparent rounded-full animate-spin" />
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
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF4500]" />
                  <h4 className="font-heading text-xs tracking-wider font-bold text-black uppercase">
                    {stage}
                  </h4>
                  <span className="text-xs font-semibold text-[#FF8A00]">
                    ({groupedCandidates[stage].length})
                  </span>
                </div>
                <div className="space-y-2">
                  {groupedCandidates[stage].map((candidate) => (
                    <motion.div
                      key={candidate.id}
                      whileHover={{ scale: 1.02 }}
                      className="p-4 rounded-xl border border-[#FF8A00]/40 bg-white shadow-sm hover:border-[#FF4500] transition-all cursor-pointer"
                    >
                      <p className="text-sm font-heading font-bold text-black">
                        {candidate.name}
                      </p>
                      <p className="text-xs text-black/80 mt-1 font-medium">
                        {candidate.position}
                      </p>
                    </motion.div>
                  ))}
                  {!groupedCandidates[stage].length && (
                    <div className="p-4 rounded-xl border border-[#FF8A00]/25 bg-white text-xs text-black/70">
                      No candidates in this stage.
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </PageWrapper>
    </div>
  );
};

export default Recruitment;
