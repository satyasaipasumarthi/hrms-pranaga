// [ticket-management] Small grey heading used above each section of the detail panel.
import type { ReactNode } from "react";

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{children}</p>
);

export default SectionTitle;
