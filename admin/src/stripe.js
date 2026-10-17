// Stripe Invoicing: email a customer an invoice they pay on Stripe's hosted page,
// check its status, void it, and verify Stripe's webhooks.

const API_VERSION = "2024-06-20"; // pinned so Stripe API changes can't break this
const WEBHOOK_TOLERANCE_SECONDS = 300;

export function stripe(env) {
  const base = env.STRIPE_API || "https://api.stripe.com";

  async function call(method, path, params) {
    if (!env.STRIPE_SECRET_KEY) {
      throw Object.assign(new Error("Stripe isn't set up yet (missing STRIPE_SECRET_KEY)."), { status: 503 });
    }
    const body = params && new URLSearchParams(flatten(params)).toString();
    const response = await fetch(`${base}${path}${method === "GET" && body ? `?${body}` : ""}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Stripe-Version": API_VERSION,
        ...(method !== "GET" && { "Content-Type": "application/x-www-form-urlencoded" }),
      },
      body: method === "GET" ? undefined : body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || `request failed (${response.status})`;
      throw Object.assign(new Error(`Stripe: ${message}`), { status: response.status >= 500 ? 502 : 400 });
    }
    return data;
  }

  return {
    /** Create an invoice for one item and have Stripe email it to the customer. */
    async sendInvoice({ name, email, description, amount, currency, note, metadata }) {
      const existing = await call("GET", "/v1/customers", { email, limit: 1 });
      const customer = existing.data?.[0] || (await call("POST", "/v1/customers", { email, name, metadata }));

      const invoice = await call("POST", "/v1/invoices", {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: 14,
        currency: currency.toLowerCase(),
        description: note || undefined,
        pending_invoice_items_behavior: "exclude",
        metadata,
      });
      await call("POST", "/v1/invoiceitems", {
        customer: customer.id,
        invoice: invoice.id,
        currency: currency.toLowerCase(),
        amount: Math.round(Number(amount) * 100),
        description,
      });
      const finalized = await call("POST", `/v1/invoices/${invoice.id}/finalize`, { auto_advance: true });
      await call("POST", `/v1/invoices/${invoice.id}/send`);
      return { id: finalized.id, number: finalized.number || finalized.id, url: finalized.hosted_invoice_url || "" };
    },

    /** { status: "open" | "paid" | "void" | "uncollectible" | "draft", url } */
    async getInvoice(id) {
      const invoice = await call("GET", `/v1/invoices/${id}`);
      return { status: invoice.status, url: invoice.hosted_invoice_url || "" };
    },

    async voidInvoice(id) {
      await call("POST", `/v1/invoices/${id}/void`);
    },
  };
}

/**
 * Check the Stripe-Signature header against the raw body, as Stripe documents:
 * HMAC-SHA256 of "<timestamp>.<body>" with the webhook's signing secret.
 */
export async function verifyStripeSignature(env, header, rawBody) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const items = header.split(",").map((part) => part.trim());
  const timestamp = Number(items.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = items.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// { metadata: { a: 1 } } -> { "metadata[a]": 1 }, skipping undefined values.
function flatten(params, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") Object.assign(out, flatten(value, name));
    else out[name] = String(value);
  }
  return out;
}
