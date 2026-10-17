// Email alerts (Cloudflare Email Routing) and server-side Google Analytics events.

import { EmailMessage } from "cloudflare:email";

/**
 * Email the workshop. Needs the NOTIFY send_email binding and NOTIFY_FROM / NOTIFY_TO vars;
 * without them (e.g. locally) the email is just logged.
 */
export async function sendAlert(env, { subject, text, replyTo }) {
  if (!env.NOTIFY || !env.NOTIFY_FROM || !env.NOTIFY_TO) {
    console.log(`[email] ${subject}\n${text}`);
    return;
  }
  const encode = (value) => btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  const body = encode(text).replace(/.{76}/g, "$&\r\n");
  const headers = [
    `From: Moar Guitars <${env.NOTIFY_FROM}>`,
    `To: ${env.NOTIFY_TO}`,
    replyTo && `Reply-To: ${replyTo.replace(/[\r\n<>]/g, "")}`,
    `Subject: =?UTF-8?B?${encode(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@moarguitars.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  const raw = `${headers.join("\r\n")}\r\n\r\n${body}`;
  try {
    await env.NOTIFY.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
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
