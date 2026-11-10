
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  trend?: string;
  delay?: number;
}

const getCardTheme = (title: string) => {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes("employee") ||
    normalizedTitle.includes("team member")
  ) {
    return {
      iconColor: "#3298F5",
      iconBackground: "#E7F3FF",
      badgeColor: "#2CCDAA",
      badgeBackground: "#E7FBF4",
    };
  }

  if (
    normalizedTitle.includes("present") ||
    normalizedTitle.includes("attendance")
  ) {
    return {
      iconColor: "#2CCDAA",
      iconBackground: "#E6FBF3",
      badgeColor: "#2CCDAA",
      badgeBackground: "#E7FBF4",
    };
  }

  if (
    normalizedTitle.includes("leave") &&
    !normalizedTitle.includes("pending")
  ) {
    return {
      iconColor: "#F45F86",
      iconBackground: "#FFF0F4",
      badgeColor: "#64748B",
      badgeBackground: "#F1F5F9",
    };
  }

  if (
    normalizedTitle.includes("pending") ||
    normalizedTitle.includes("approval")
  ) {
    return {
      iconColor: "#FF8652",
      iconBackground: "#FFF0E6",
      badgeColor: "#F45F86",
      badgeBackground: "#FFF0F4",
    };
  }

  if (normalizedTitle.includes("department")) {
    return {
      iconColor: "#8B78F6",
      iconBackground: "#F0EDFF",
      badgeColor: "#2CCDAA",
      badgeBackground: "#E7FBF4",
    };
  }

  if (normalizedTitle.includes("kudos")) {
    return {
      iconColor: "#F7BD4D",
      iconBackground: "#FFF7E5",
      badgeColor: "#2CCDAA",
      badgeBackground: "#E7FBF4",
    };
  }

  return {
    iconColor: "#3298F5",
    iconBackground: "#E7F3FF",
    badgeColor: "#2CCDAA",
    badgeBackground: "#E7FBF4",
  };
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  suffix = "",
  trend,
  delay = 0,
}: StatCardProps) => {
  const theme = getCardTheme(title);

  const isNegativeTrend =
    trend?.toLowerCase().includes("decrease") ||
    trend?.toLowerCase().includes("down");

  const isNeutralTrend =
    trend?.toLowerCase().includes("awaiting") ||
    trend?.toLowerCase().includes("approval") ||
    trend?.toLowerCase().includes("scope") ||
    trend?.toLowerCase().includes("recognition") ||
    trend?.toLowerCase().includes("workflow") ||
    trend?.toLowerCase().includes("configured") ||
    trend?.toLowerCase().includes("organization") ||
    trend?.toLowerCase().includes("visible") ||
    trend?.toLowerCase().includes("operational") ||
    trend?.toLowerCase().includes("direct reports");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: "easeOut",
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 },
      }}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#E7EDF5] bg-white p-4 shadow-[0_3px_12px_rgba(20,38,79,0.035)] transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(20,38,79,0.07)] sm:p-5"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: theme.iconBackground,
            color: theme.iconColor,
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>

        {trend && (
          <span
            className="inline-flex max-w-[65%] items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium sm:text-xs"
            style={{
              color: isNeutralTrend
                ? "#64748B"
                : isNegativeTrend
                  ? "#E14F70"
                  : theme.badgeColor,
              backgroundColor: isNeutralTrend
                ? "#F1F5F9"
                : isNegativeTrend
                  ? "#FFF0F4"
                  : theme.badgeBackground,
            }}
          >
            {isNeutralTrend ? (
              <Minus className="h-3 w-3 shrink-0" />
            ) : isNegativeTrend ? (
              <ArrowDownRight className="h-3 w-3 shrink-0" />
            ) : (
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{trend}</span>
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#647A98] sm:text-xs">
          {title}
        </p>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-heading text-2xl font-bold leading-tight text-[#14264F] sm:text-3xl">
            <AnimatedCounter target={value} />
          </span>

          {suffix && (
            <span className="text-xs text-[#647A98]">
              {suffix}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
