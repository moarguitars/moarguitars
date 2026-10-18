// The Insights page: Google Analytics numbers per guitar next to what the admin itself
// knows (enquiries, budgets given, invoices sent and paid).

import { guitarAnalytics } from "./analytics.js";
import { readContent } from "./content.js";

const ALLOWED_DAYS = [7, 30, 90];
const GENERAL = "General enquiry";

export async function insights(env, gh, daysParam) {
  const days = ALLOWED_DAYS.includes(Number(daysParam)) ? Number(daysParam) : 30;
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const [content, ga, enquiries, payments] = await Promise.all([
    readContent(gh),
    guitarAnalytics(env, days),
    env.DB.prepare("SELECT guitar_name, answers FROM enquiries WHERE created_at >= ?").bind(since).all(),
    env.DB.prepare(
      `SELECT e.guitar_name, p.status, p.amount, p.currency
         FROM payments p JOIN enquiries e ON e.id = p.enquiry_id
        WHERE p.created_at >= ?`,
    )
      .bind(since)
      .all(),
  ]);

  // One row per guitar, in site order, plus anything only seen in data (e.g. a removed guitar).
  const rows = new Map();
  const row = (name) => {
    if (!rows.has(name)) {
      rows.set(name, { name, onSite: false, enquiries: 0, budgets: {}, invoiced: 0, paid: 0, paidTotals: {} });
    }
    return rows.get(name);
  };
  for (const guitar of content.guitars) row(guitar.title).onSite = true;

  for (const enquiry of enquiries.results) {
    const r = row(enquiry.guitar_name);
    r.enquiries += 1;
    const budget = JSON.parse(enquiry.answers || "[]").find((a) => /budget/i.test(a.question))?.answer;
    if (budget) r.budgets[budget] = (r.budgets[budget] || 0) + 1;
  }
  for (const payment of payments.results) {
    const r = row(payment.guitar_name);
    if (payment.status !== "cancelled") r.invoiced += 1;
    if (payment.status === "paid") {
      r.paid += 1;
      r.paidTotals[payment.currency] = (r.paidTotals[payment.currency] || 0) + Number(payment.amount);
    }
  }
  if (ga.guitars) for (const name of Object.keys(ga.guitars)) row(name);

  const guitars = [...rows.values()]
    .filter((r) => r.name !== GENERAL)
    .map((r) => ({ ...r, ga: ga.guitars?.[r.name] || null }));
  const general = rows.get(GENERAL) || null;

  return {
    days,
    analytics: { configured: ga.configured, error: ga.error, visitors: ga.totals?.visitors ?? null, engagementAvailable: ga.engagementAvailable ?? false },
    guitars,
    general,
    totals: {
      enquiries: enquiries.results.length,
      invoiced: guitars.reduce((n, r) => n + r.invoiced, 0) + (general?.invoiced || 0),
      paid: guitars.reduce((n, r) => n + r.paid, 0) + (general?.paid || 0),
    },
  };
}
