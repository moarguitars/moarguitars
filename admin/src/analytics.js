// Read-only Google Analytics 4 reports (GA4 Data API), using a Google service account.
//
// GA_SERVICE_ACCOUNT is the service account's JSON key (a secret); GA_PROPERTY_ID is the
// numeric GA4 property. The service account needs "Viewer" access on that property.

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_MS = 15 * 60 * 1000; // GA data isn't real-time anyway
const reportCache = new Map(); // days -> { at, value }
let cachedToken = null; // { value, expires }

// Events the site sends (see assets/js/analytics.js), keyed by what the Insights page calls them.
const EVENTS = {
  select_item: "clicked",
  view_photo: "photos",
  enquiry_open: "formOpened",
  generate_lead: "enquired",
};

// On this day guitars became click-to-open. Before it, view_item meant "price scrolled into
// view" and time was counted while merely visible, so opens, time and the enquiry rate are
// only counted from here on.
export const OPENS_SINCE = "2026-10-18";

/**
 * Per-guitar GA numbers for the last `days` days:
 * { configured, error?, opensSince, totals: { visitors },
 *   guitars: { [name]: { clicked, photos, formOpened, enquired, opened, enquiredSinceOpen, seconds } } }
 * Counts are people (unique users), except photos (opens) and seconds (total time).
 * opened, enquiredSinceOpen and seconds cover the period from opensSince only.
 */
export async function guitarAnalytics(env, days) {
  if (!env.GA_SERVICE_ACCOUNT || !env.GA_PROPERTY_ID) return { configured: false };
  const hit = reportCache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const periodStart = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const opensSince = periodStart < OPENS_SINCE ? OPENS_SINCE : null;
  const openRanges = opensSince ? [{ startDate: opensSince, endDate: "today" }] : dateRanges;
  const guitars = {};
  const row = (name) =>
    (guitars[name] ??= { clicked: 0, photos: 0, formOpened: 0, enquired: 0, opened: 0, enquiredSinceOpen: 0, seconds: 0 });

  try {
    const [events, opens, engagement, totals] = await Promise.all([
      runReport(env, {
        dateRanges,
        dimensions: [{ name: "eventName" }, { name: "customEvent:guitar" }],
        metrics: [{ name: "totalUsers" }, { name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: Object.keys(EVENTS) } } },
        limit: 1000,
      }),
      // Opens and the enquiries that follow them, in the same window so the rate is fair.
      runReport(env, {
        dateRanges: openRanges,
        dimensions: [{ name: "eventName" }, { name: "customEvent:guitar" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["view_item", "generate_lead"] } } },
        limit: 1000,
      }),
      runReport(env, {
        dateRanges: openRanges,
        dimensions: [{ name: "customEvent:guitar" }],
        metrics: [{ name: "customEvent:engagement_seconds" }],
        dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: "guitar_engagement" } } },
        limit: 1000,
      }).catch(() => null), // the "Seconds on guitar" metric may not be set up yet
      runReport(env, { dateRanges, metrics: [{ name: "totalUsers" }] }),
    ]);

    for (const r of events.rows || []) {
      const [eventName, guitar] = r.dimensionValues.map((d) => d.value);
      if (!guitar || guitar === "(not set)") continue;
      const key = EVENTS[eventName];
      // Photos count opens; everything else counts people.
      row(guitar)[key] = Number(r.metricValues[key === "photos" ? 1 : 0].value);
    }
    for (const r of opens.rows || []) {
      const [eventName, guitar] = r.dimensionValues.map((d) => d.value);
      if (!guitar || guitar === "(not set)") continue;
      row(guitar)[eventName === "view_item" ? "opened" : "enquiredSinceOpen"] = Number(r.metricValues[0].value);
    }
    for (const r of engagement?.rows || []) {
      const guitar = r.dimensionValues[0].value;
      if (guitar && guitar !== "(not set)") row(guitar).seconds = Math.round(Number(r.metricValues[0].value));
    }

    const value = {
      configured: true,
      opensSince,
      totals: { visitors: Number(totals.rows?.[0]?.metricValues?.[0]?.value || 0) },
      guitars,
      engagementAvailable: Boolean(engagement),
    };
    reportCache.set(days, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("Analytics report failed", error);
    return { configured: true, error: explain(error) };
  }
}

async function runReport(env, body) {
  const base = env.GA_DATA_API || "https://analyticsdata.googleapis.com";
  const response = await fetch(`${base}/v1beta/properties/${env.GA_PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || `GA request failed (${response.status})`), { code: response.status });
  return data;
}

// Exchange a signed JWT for a short-lived access token (Google's service account flow).
async function accessToken(env) {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;

  const account = JSON.parse(env.GA_SERVICE_ACCOUNT);
  const tokenUrl = env.GOOGLE_TOKEN_URL || account.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: tokenUrl,
    iat: now,
    exp: now + 3600,
  })}`;

  const pem = account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error_description || data.error || "Google sign-in failed"), { code: response.status });
  cachedToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function explain(error) {
  const message = String(error.message || "");
  if (/customEvent:guitar/.test(message)) {
    return "Google Analytics doesn't know the “guitar” custom dimension yet. Add it under Admin → Custom definitions (event parameter: guitar).";
  }
  if (error.code === 403) {
    return "The admin isn't allowed to read Google Analytics. Check the service account has Viewer access on the property.";
  }
  if (/invalid_grant|Google sign-in/.test(message)) {
    return "Google rejected the admin's service account key. It may have been deleted; create a new key and save it again.";
  }
  return "Couldn't load Google Analytics right now. Try again in a few minutes.";
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
