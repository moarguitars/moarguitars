// Email alerts (via Resend) and server-side Google Analytics events.

/**
 * Email the workshop through Resend. Needs RESEND_API_KEY and NOTIFY_FROM / NOTIFY_TO;
 * without the key (e.g. locally) the email is just logged.
 */
export async function sendAlert(env, { subject, text, replyTo }) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM || !env.NOTIFY_TO) {
    console.log(`[email] ${subject}\n${text}`);
    return;
  }
  try {
    const response = await fetch(env.RESEND_API || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Moar Guitars website <${env.NOTIFY_FROM}>`,
        to: env.NOTIFY_TO.split(",").map((address) => address.trim()),
        subject,
        text,
        ...(replyTo && { reply_to: replyTo }),
      }),
    });
    if (!response.ok) console.error("Email alert failed", response.status, await response.text());
  } catch (error) {
    // An alert failing must never lose the enquiry itself.
    console.error("Email alert failed", error);
  }
}

/**
 * Send an event to Google Analytics for the visitor who made the enquiry, so payments
 * show up against the guitar they enquired about. Needs GA_MEASUREMENT_ID + GA_API_SECRET.
 */
export async function trackServerEvent(env, clientId, name, params) {
  if (!clientId || !env.GA_MEASUREMENT_ID || !env.GA_API_SECRET) return;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(env.GA_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(env.GA_API_SECRET)}`;
  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, events: [{ name, params }] }),
    });
  } catch (error) {
    console.error("Analytics event failed", error);
  }
}
