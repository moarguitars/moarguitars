// A stand-in for PayPal's Invoicing API for local testing. Invoices get a pretend
// payment page; clicking "Pay" sends the same webhook PayPal would.
//
//   node dev/mock-paypal.mjs [port] [webhook url]

import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.argv[2] || 8789);
const webhookUrl = process.argv[3] || "http://localhost:8787/api/paypal/webhook";
const invoices = new Map();

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { raw: text };
  }
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function webhook(type, invoice) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "paypal-transmission-id": "mock" },
    body: JSON.stringify({ event_type: type, resource: { invoice: { id: invoice.id } } }),
  }).catch((error) => console.error("webhook failed", error.message));
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;
  const body = req.method === "POST" ? await readBody(req) : {};

  if (path === "/v1/oauth2/token") return send(res, 200, { access_token: "mock-token", expires_in: 3600 });

  // Pretend payment page for customers.
  const page = path.match(/^\/invoice\/p\/(.+)$/);
  if (page) {
    const invoice = invoices.get(page[1]);
    if (!invoice) return send(res, 404, "Not found", "text/plain");
    const item = invoice.items[0];
    return send(res, 200, `<!doctype html><meta name="viewport" content="width=device-width"><title>Mock PayPal invoice</title>
<body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem">
<p style="color:#888">MOCK PAYPAL (local testing)</p>
<h1>Invoice ${escape(invoice.detail.invoice_number)}</h1>
<p>${escape(item.name)}</p>
<p style="font-size:2rem">${escape(item.unit_amount.currency_code)} ${escape(item.unit_amount.value)}</p>
<p>Status: <strong>${invoice.status}</strong></p>
${invoice.status === "SENT" ? `<form method="post" action="/mock/pay/${invoice.id}"><button style="font-size:1.2rem;padding:.6rem 1.5rem">Pay</button></form>` : ""}
</body>`, "text/html");
  }
  const pay = path.match(/^\/mock\/pay\/(.+)$/);
  if (pay && req.method === "POST") {
    const invoice = invoices.get(pay[1]);
    if (invoice && invoice.status === "SENT") {
      invoice.status = "PAID";
      console.log(`paid ${invoice.id}`);
      await webhook("INVOICING.INVOICE.PAID", invoice);
    }
    res.writeHead(303, { Location: `/invoice/p/${pay[1]}` });
    return res.end();
  }

  if (!req.headers.authorization) return send(res, 401, { message: "Unauthorized" });

  if (path === "/v2/invoicing/invoices" && req.method === "POST") {
    if ([...invoices.values()].some((i) => i.detail.invoice_number === body.detail?.invoice_number)) {
      return send(res, 422, { details: [{ description: "Invoice number already exists." }] });
    }
    const id = `INV2-MOCK-${randomBytes(4).toString("hex").toUpperCase()}`;
    invoices.set(id, { id, status: "DRAFT", ...body });
    console.log(`invoice ${id} for ${body.primary_recipients?.[0]?.billing_info?.email_address}: ${body.items?.[0]?.unit_amount?.currency_code} ${body.items?.[0]?.unit_amount?.value}`);
    return send(res, 201, { id, status: "DRAFT", ...body });
  }

  const action = path.match(/^\/v2\/invoicing\/invoices\/([^/]+)(?:\/(send|cancel))?$/);
  if (action) {
    const invoice = invoices.get(action[1]);
    if (!invoice) return send(res, 404, { message: "Not found" });
    const viewUrl = `http://localhost:${port}/invoice/p/${invoice.id}`;
    if (action[2] === "send") {
      invoice.status = "SENT";
      return send(res, 200, { href: viewUrl, rel: "payer-view", method: "GET" });
    }
    if (action[2] === "cancel") {
      invoice.status = "CANCELLED";
      res.writeHead(204);
      return res.end();
    }
    return send(res, 200, { ...invoice, detail: { ...invoice.detail, metadata: { recipient_view_url: viewUrl } } });
  }

  if (path === "/v1/notifications/verify-webhook-signature") {
    return send(res, 200, { verification_status: body.transmission_id === "mock" ? "SUCCESS" : "FAILURE" });
  }

  send(res, 404, { message: "Not found" });
}).listen(port, () => console.log(`Mock PayPal on http://localhost:${port}`));
