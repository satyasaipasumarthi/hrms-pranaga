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
  /** Renders the button as a real link so right-click offers "Open link in new tab". */
  href?: string;
  /** Named window/tab target used for href navigation, e.g. "apply-leave". */
  target?: string;
  /** Set false for a flat button with no hover glow / press scale (default true). */
  glow?: boolean;
}

const GlowButton = ({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
  href,
  target,
  glow = true,
}: GlowButtonProps) => {
  const base = "px-6 py-3 rounded-lg font-heading text-sm tracking-wider uppercase transition-all duration-300 disabled:opacity-50";

  const variants = {
    primary: glow
      ? "bg-secondary text-secondary-foreground hover:shadow-[0_0_25px_hsl(217_91%_60%/0.4)] active:scale-[0.98]"
      : "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    secondary: glow
      ? "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 hover:shadow-[0_0_20px_hsl(217_91%_60%/0.3)]"
      : "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
  };

  const motionProps = glow ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } } : {};

  if (href && !disabled) {
    return (
      <motion.a
        {...motionProps}
        href={href}
        target={target}
        rel="noopener noreferrer"
        onClick={onClick}
        className={cn(base, variants[variant], "inline-flex no-underline", className)}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      {...motionProps}
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
