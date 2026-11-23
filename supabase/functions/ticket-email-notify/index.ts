// [ticket-management] E-mails the person a ticket is assigned to.
//
// How it works: when a ticket is assigned (new ticket, or re-assigned) the database adds a row to
// public.ticket_notifications. A Supabase "Database Webhook" calls this function for every new row,
// and the function sends the e-mail through Resend (resend.com).
//
// Setup (once) - see the numbered steps:
//   1. Create a Resend account, create an API key. To send to anyone you must verify a domain in Resend
//      ("Domains"). Without a domain Resend only lets you send from onboarding@resend.dev to your own address (testing).
//   2. Generate a random secret, e.g.   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   3. supabase secrets set RESEND_API_KEY=... TICKET_EMAIL_FROM="HRMS Helpdesk <helpdesk@yourdomain.com>" \
//        APP_URL=https://your-hrms-url TICKET_WEBHOOK_SECRET=<the secret from step 2>
//   4. supabase functions deploy ticket-email-notify
//   5. Supabase dashboard -> Database -> Webhooks -> Create a new hook:
//        table public.ticket_notifications, event INSERT, type "Supabase Edge Functions",
//        function ticket-email-notify, and add the HTTP header  x-webhook-secret: <the secret from step 2>.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every edge function automatically.

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Only assignments are e-mailed. To e-mail more kinds of alerts, add them here:
// "added" (added to a ticket), "mention", "review", "sla" (deadline close), "escalation".
const EMAIL_KINDS = new Set(["assigned"]);

const PRIORITY_LABEL: Record<string, string> = { highest: "Highest", high: "High", medium: "Medium", low: "Low", lowest: "Lowest" };

interface TicketRow {
  number: number;
  title: string;
  description: string | null;
  priority: string;
  due_date: string;
  category: string;
  team_name: string | null;
  raised_by_name: string;
}

/** Reads the ticket with the service role so the e-mail can show priority, deadline and who raised it. */
const fetchTicket = async (id: string): Promise<TicketRow | null> => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const select = "number,title,description,priority,due_date,category,team_name,raised_by_name";
  const response = await fetch(`${url}/rest/v1/tickets?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as TicketRow[];
  return rows[0] ?? null;
};

const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("TICKET_WEBHOOK_SECRET");
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("TICKET_EMAIL_FROM");
  if (!apiKey || !from) return jsonResponse({ error: "RESEND_API_KEY / TICKET_EMAIL_FROM not configured" }, 500);

  const payload = await request.json().catch(() => null);
  const record = payload?.record as
    | { recipient_email: string; ticket_id: string | null; kind: string; title: string; body: string | null }
    | undefined;
  if (!record?.recipient_email) return jsonResponse({ skipped: "no record" });
  if (!EMAIL_KINDS.has(record.kind)) return jsonResponse({ skipped: `kind ${record.kind}` });

  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const link = record.ticket_id && appUrl ? `${appUrl}/tickets?ticket=${record.ticket_id}` : appUrl;
  const ticket = record.ticket_id ? await fetchTicket(record.ticket_id).catch(() => null) : null;

  const detailRows: [string, string][] = ticket
    ? [
        ["Ticket", `TKT-${ticket.number}`],
        ["Title", ticket.title],
        ["Priority", PRIORITY_LABEL[ticket.priority] ?? ticket.priority],
        ["Deadline", formatDeadline(ticket.due_date)],
        ["Category", ticket.team_name ? `${ticket.category} · ${ticket.team_name}` : ticket.category],
        ["Raised by", ticket.raised_by_name],
      ]
    : [];

  const description = ticket?.description?.trim();
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
      <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(record.title)}</h2>
      ${
        detailRows.length
          ? `<table style="border-collapse:collapse;font-size:14px;margin:0 0 14px">${detailRows
              .map(
                ([label, value]) =>
                  `<tr><td style="padding:3px 16px 3px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:3px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
              )
              .join("")}</table>`
          : record.body
            ? `<p style="font-size:14px;line-height:1.5;color:#334155">${escapeHtml(record.body)}</p>`
            : ""
      }
      ${description ? `<p style="font-size:14px;line-height:1.5;color:#334155;white-space:pre-wrap">${escapeHtml(description.slice(0, 400))}${description.length > 400 ? "…" : ""}</p>` : ""}
      ${link ? `<p><a href="${link}" style="display:inline-block;background:#E87532;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Open ticket</a></p>` : ""}
      <p style="font-size:12px;color:#94a3b8;margin-top:24px">You received this because a ticket was assigned to you in the HRMS helpdesk.</p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [record.recipient_email],
      subject: ticket ? `[TKT-${ticket.number}] ${ticket.title}` : record.title,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Resend error", response.status, text);
    return jsonResponse({ error: "Email provider error", status: response.status }, 502);
  }
  return jsonResponse({ sent: true });
});
