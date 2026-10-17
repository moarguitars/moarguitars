// PayPal Invoicing: create and send an invoice, check its status, cancel it,
// and verify webhooks. Customers can pay an invoice by card without a PayPal account.

let cachedToken = null; // { value, expires }

export function paypal(env) {
  const base = env.PAYPAL_API || "https://api-m.paypal.com";

  async function token() {
    if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw Object.assign(new Error("PayPal isn't set up yet (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)."), { status: 503 });
    }
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error(`PayPal sign-in failed (${response.status})`);
    const data = await response.json();
    cachedToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return cachedToken.value;
  }

  async function call(method, path, body, headers = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body && JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.details?.[0]?.description || data.message || "";
      throw Object.assign(new Error(`PayPal: ${detail || `request failed (${response.status})`}`), { status: response.status >= 500 ? 502 : 400 });
    }
    return data;
  }

  return {
    /** Create an invoice for one item and email it to the customer. */
    async sendInvoice({ number, name, email, description, amount, currency, note }) {
      const money = { currency_code: currency, value: amount };
      const draft = await call(
        "POST",
        "/v2/invoicing/invoices",
        {
          detail: { invoice_number: number, currency_code: currency, note, payment_term: { term_type: "DUE_ON_RECEIPT" } },
          primary_recipients: [{ billing_info: { name: { full_name: name }, email_address: email } }],
          items: [{ name: description, quantity: "1", unit_amount: money }],
        },
        { Prefer: "return=representation" },
      );
      const id = draft.id || draft.href?.split("/").pop();
      const sent = await call("POST", `/v2/invoicing/invoices/${id}/send`, { send_to_recipient: true, send_to_invoicer: true });
      const url = sent.href || (await this.getInvoice(id)).url;
      return { id, url };
    },

    /** { status: "SENT" | "PAID" | "CANCELLED" | ..., url } */
    async getInvoice(id) {
      const invoice = await call("GET", `/v2/invoicing/invoices/${id}`);
      return { status: invoice.status, url: invoice.detail?.metadata?.recipient_view_url || "" };
    },

    async cancelInvoice(id) {
      await call("POST", `/v2/invoicing/invoices/${id}/cancel`, {
        send_to_recipient: true,
        send_to_invoicer: false,
        note: "This payment request has been cancelled.",
      });
    },

    /** Ask PayPal whether a webhook really came from them. */
    async verifyWebhook(request, event) {
      if (!env.PAYPAL_WEBHOOK_ID) return false;
      const header = (name) => request.headers.get(name) || "";
      const result = await call("POST", "/v1/notifications/verify-webhook-signature", {
        auth_algo: header("paypal-auth-algo"),
        cert_url: header("paypal-cert-url"),
        transmission_id: header("paypal-transmission-id"),
        transmission_sig: header("paypal-transmission-sig"),
        transmission_time: header("paypal-transmission-time"),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      });
      return result.verification_status === "SUCCESS";
    },
  };
}
