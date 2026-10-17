// Email alerts (via Formspree) and server-side Google Analytics events.

/**
 * Email the workshop by submitting to a Formspree form, which emails whoever the form
 * delivers to. Needs FORMSPREE_FORM (the form ID); without it the alert is just logged.
 * Formspree's free plan allows 50 submissions a month.
 */
export async function sendAlert(env, { subject, text, replyTo }) {
  if (!env.FORMSPREE_FORM) {
    console.log(`[email] ${subject}\n${text}`);
    return;
  }
  try {
    const base = env.FORMSPREE_URL || "https://formspree.io/f/";
    const response = await fetch(`${base}${encodeURIComponent(env.FORMSPREE_FORM)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        // Formspree uses "email" as the reply-to address.
        ...(replyTo && { email: replyTo }),
        message: text,
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
