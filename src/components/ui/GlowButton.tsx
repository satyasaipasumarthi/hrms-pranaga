import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const GlowButton = ({ children, onClick, variant = "primary", className, disabled, type = "button" }: GlowButtonProps) => {
  const base = "px-6 py-3 rounded-lg font-heading text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-50";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:shadow-[0_0_25px_hsl(18_100%_59%/0.4)] active:scale-[0.98]",
    secondary: "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 hover:shadow-[0_0_20px_hsl(217_91%_60%/0.3)]",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={cn(base, variants[variant], className)}
    >
      {children}
    </motion.button>
  );
};

export default GlowButton;
