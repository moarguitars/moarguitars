// The Insights page: Google Analytics numbers per guitar next to what the admin itself
// knows (enquiries, budgets given, invoices sent and paid), per guitar and per country.

import { countryAnalytics, guitarAnalytics } from "./analytics.js";
import { readContent } from "./content.js";
import { countryName } from "./enquiries.js";

const ALLOWED_DAYS = [7, 30, 90];
const GENERAL = "General enquiry";

export async function insights(env, gh, daysParam) {
  const days = ALLOWED_DAYS.includes(Number(daysParam)) ? Number(daysParam) : 30;
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const [content, ga, gaCountries, enquiries, payments] = await Promise.all([
    readContent(gh),
    guitarAnalytics(env, days),
    countryAnalytics(env, days),
    env.DB.prepare("SELECT guitar_name, answers, country FROM enquiries WHERE created_at >= ?").bind(since).all(),
    env.DB.prepare(
      `SELECT e.guitar_name, e.country, p.status, p.amount, p.currency
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

  // One row per visitor country ('' = unknown), from both sources.
  const byCountry = new Map();
  const country = (code) => {
    if (!byCountry.has(code)) {
      byCountry.set(code, { code, name: code ? countryName(code) : "Unknown", ga: null, enquiries: 0, invoiced: 0, paid: 0, paidTotals: {} });
    }
    return byCountry.get(code);
  };
  for (const [code, values] of Object.entries(gaCountries.countries || {})) {
    country(code).ga = { visitors: values.visitors, opened: values.opened };
  }
  for (const enquiry of enquiries.results) country(enquiry.country || "").enquiries += 1;
  for (const payment of payments.results) {
    const r = country(payment.country || "");
    if (payment.status !== "cancelled") r.invoiced += 1;
    if (payment.status === "paid") {
      r.paid += 1;
      r.paidTotals[payment.currency] = (r.paidTotals[payment.currency] || 0) + Number(payment.amount);
    }
  }
  const countries = [...byCountry.values()].sort(
    (a, b) =>
      (a.code === "") - (b.code === "") || // unknown last
      (b.ga?.visitors || 0) - (a.ga?.visitors || 0) ||
      b.enquiries - a.enquiries ||
      b.paid - a.paid ||
      a.name.localeCompare(b.name),
  );

  return {
    days,
    analytics: {
      configured: ga.configured,
      error: ga.error,
      visitors: ga.totals?.visitors ?? null,
      engagementAvailable: ga.engagementAvailable ?? false,
      countriesError: ga.error ? null : gaCountries.error || null,
    },
    guitars,
    general,
    countries,
    totals: {
      enquiries: enquiries.results.length,
      invoiced: guitars.reduce((n, r) => n + r.invoiced, 0) + (general?.invoiced || 0),
      paid: guitars.reduce((n, r) => n + r.paid, 0) + (general?.paid || 0),
    },
  };
}
