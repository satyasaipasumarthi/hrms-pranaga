import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  label?: string;
  action?: ReactNode;
}

const PageWrapper = ({ children, title, label, action }: PageWrapperProps) => {
  useEffect(() => {
    const pageName = title || label;
    document.title = pageName ? `${pageName} | PraNaga HRMS` : "PraNaga HRMS";
  }, [title, label]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="p-6 lg:p-8 space-y-6"
    >
      {(label || title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            {label && <p className="section-label">{label}</p>}
            {title && (
              <h1 className="text-2xl lg:text-3xl font-heading font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.div>
  );
};

export default PageWrapper;
