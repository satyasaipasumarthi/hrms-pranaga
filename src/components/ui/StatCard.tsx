import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  trend?: string;
  delay?: number;
}

const StatCard = ({ title, value, icon: Icon, suffix = "", trend, delay = 0 }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className="glass-card-glow p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading tracking-wider uppercase text-muted-foreground">{title}</p>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-heading font-bold text-foreground">
          <AnimatedCounter target={value} />
        </span>
        {suffix && <span className="text-sm text-muted-foreground mb-1">{suffix}</span>}
      </div>
      {trend && (
        <p className="text-xs text-secondary">{trend}</p>
      )}
    </motion.div>
  );
};

export default StatCard;
