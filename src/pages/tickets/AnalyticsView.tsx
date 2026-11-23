// [ticket-management] Analytics: KPIs, status mix, opened vs closed trend, team volume,
// assignee workload and satisfaction, plus Excel / CSV export.
import { useMemo, useState } from "react";
import { addWeeks, differenceInHours, format, startOfWeek } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, Flame, Smile, Target, Ticket as TicketIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stars } from "./TicketBits";
import { PRIORITIES, STATUSES, isDone, type Ticket } from "./types";

// Validated pair (dataviz validator, light surface): ≥3:1 contrast, CVD ΔE ≈ 32.
const OPENED = "#C2410C";
const CLOSED = "#2563EB";
const SINGLE = "#C2410C";
const AXIS = { fontSize: 11, fill: "#64748b" };

const Tile = ({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: string; hint?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon className="h-4 w-4" />{label}</div>
    <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className ?? ""}`}>
    <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
    {children}
  </section>
);

const tooltipStyle = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 };

const AnalyticsView = ({ tickets }: { tickets: Ticket[] }) => {
  const [range, setRange] = useState<"4" | "12" | "26">("12");
  const weeks = Number(range);

  const data = useMemo(() => {
    const since = startOfWeek(addWeeks(new Date(), -(weeks - 1)), { weekStartsOn: 1 });
    const inRange = tickets.filter((t) => new Date(t.createdAt) >= since || (t.closedAt && new Date(t.closedAt) >= since));
    const closed = tickets.filter((t) => t.status === "closed" && t.closedAt);
    const closedInRange = closed.filter((t) => new Date(t.closedAt!) >= since);
    const active = tickets.filter((t) => !isDone(t));

    const resolutionHours = closedInRange.map((t) => differenceInHours(new Date(t.closedAt!), new Date(t.createdAt)));
    const avgHours = resolutionHours.length ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length : 0;
    const onTime = closedInRange.filter((t) => new Date(t.closedAt!) <= new Date(t.dueDate)).length;
    const rated = closedInRange.filter((t) => t.rating);
    const avgRating = rated.length ? rated.reduce((a, t) => a + t.rating!, 0) / rated.length : 0;

    const trend = Array.from({ length: weeks }, (_, i) => {
      const start = addWeeks(since, i);
      const end = addWeeks(start, 1);
      const within = (iso: string | null) => Boolean(iso) && new Date(iso!) >= start && new Date(iso!) < end;
      return {
        week: format(start, "d MMM"),
        Opened: tickets.filter((t) => within(t.createdAt)).length,
        Closed: closed.filter((t) => within(t.closedAt)).length,
      };
    });

    const byStatus = STATUSES.map((s) => ({ name: s.label, value: tickets.filter((t) => t.status === s.id).length, color: s.hex }));
    const byPriority = PRIORITIES.map((p) => ({ name: p.label, value: active.filter((t) => t.priority === p.id).length, color: p.hex }));

    const teamMap = new Map<string, { name: string; total: number; open: number; ratings: number[] }>();
    inRange.forEach((t) => {
      const key = t.team?.name ?? `${t.category} (no team)`;
      if (!teamMap.has(key)) teamMap.set(key, { name: key, total: 0, open: 0, ratings: [] });
      const row = teamMap.get(key)!;
      row.total++;
      if (!isDone(t)) row.open++;
      if (t.rating) row.ratings.push(t.rating);
    });
    const byTeam = [...teamMap.values()].sort((a, b) => b.total - a.total);

    const loadMap = new Map<string, { name: string; open: number; overdue: number }>();
    active.forEach((t) => {
      const key = t.assignee?.email?.toLowerCase() ?? t.assignee?.id ?? "Unassigned";
      if (!loadMap.has(key)) loadMap.set(key, { name: t.assignee?.name ?? "Unassigned", open: 0, overdue: 0 });
      const row = loadMap.get(key)!;
      row.open++;
      if (t.status !== "on_hold" && new Date(t.dueDate) < new Date()) row.overdue++;
    });
    const workload = [...loadMap.values()].sort((a, b) => b.open - a.open).slice(0, 12);

    return {
      total: inRange.length,
      active: active.length,
      escalated: active.filter((t) => t.escalationLevel > 0).length,
      avgHours,
      onTimePct: closedInRange.length ? Math.round((onTime / closedInRange.length) * 100) : null,
      closedCount: closedInRange.length,
      avgRating,
      ratedCount: rated.length,
      trend,
      byStatus,
      byPriority,
      byTeam,
      workload,
    };
  }, [tickets, weeks]);

  const formatDuration = (hours: number) => (hours === 0 ? "-" : hours < 48 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1)} days`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="h-9 w-[160px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4">Last 4 weeks</SelectItem>
            <SelectItem value="12">Last 12 weeks</SelectItem>
            <SelectItem value="26">Last 6 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile icon={TicketIcon} label="Tickets in period" value={String(data.total)} hint={`${data.active} active now`} />
        <Tile icon={Clock} label="Avg. resolution" value={formatDuration(data.avgHours)} hint={`${data.closedCount} closed`} />
        <Tile icon={Target} label="Met due date" value={data.onTimePct === null ? "-" : `${data.onTimePct}%`} hint="of closed tickets" />
        <Tile icon={Flame} label="Escalated now" value={String(data.escalated)} hint="overdue, still open" />
        <Tile icon={Smile} label="Satisfaction" value={data.avgRating ? `${data.avgRating.toFixed(1)} / 5` : "-"} hint={`${data.ratedCount} ratings`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Opened vs closed per week" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.trend} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#cbd5e1" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#334155" }} iconType="plainline" />
                <Line type="monotone" dataKey="Opened" stroke={OPENED} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Closed" stroke={CLOSED} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="All tickets by status">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.byStatus} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={6}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Tickets" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#334155" }}>
                  {data.byStatus.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Tickets per team (period)" className="lg:col-span-2">
          {data.byTeam.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No tickets in this period.</p>
          ) : (
            <div style={{ height: Math.max(160, data.byTeam.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={data.byTeam} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={6}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="total" name="Tickets" fill={SINGLE} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#334155" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Active tickets by priority">
          <ul className="space-y-3">
            {data.byPriority.map((p) => {
              const max = Math.max(1, ...data.byPriority.map((x) => x.value));
              return (
                <li key={p.name} className="text-sm">
                  <div className="mb-1 flex justify-between text-slate-700"><span>{p.name}</span><span className="font-medium">{p.value}</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(p.value / max) * 100}%`, background: p.color }} /></div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Team workload (open tickets per person)">
          {data.workload.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No open tickets.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="pb-2 font-medium">Assigned to</th><th className="pb-2 font-medium">Open</th><th className="pb-2 font-medium">Overdue</th><th className="w-1/3 pb-2" /></tr>
              </thead>
              <tbody>
                {data.workload.map((row) => {
                  const max = Math.max(...data.workload.map((r) => r.open));
                  return (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="py-2 text-slate-800">{row.name}</td>
                      <td className="py-2 font-medium">{row.open}</td>
                      <td className={`py-2 ${row.overdue ? "font-semibold text-red-600" : "text-slate-400"}`}>{row.overdue}</td>
                      <td className="py-2"><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(row.open / max) * 100}%`, background: SINGLE }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Satisfaction by team">
          {data.byTeam.filter((t) => t.ratings.length).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No ratings yet. Requesters rate when they confirm a ticket is solved.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="pb-2 font-medium">Team</th><th className="pb-2 font-medium">Average</th><th className="pb-2 font-medium">Ratings</th></tr>
              </thead>
              <tbody>
                {data.byTeam
                  .filter((t) => t.ratings.length)
                  .map((t) => {
                    const avg = t.ratings.reduce((a, b) => a + b, 0) / t.ratings.length;
                    return (
                      <tr key={t.name} className="border-t border-slate-100">
                        <td className="py-2 text-slate-800">{t.name}</td>
                        <td className="py-2"><span className="flex items-center gap-2"><Stars value={avg} size="h-3.5 w-3.5" /><span className="text-xs text-slate-600">{avg.toFixed(1)}</span></span></td>
                        <td className="py-2 text-slate-600">{t.ratings.length}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsView;
