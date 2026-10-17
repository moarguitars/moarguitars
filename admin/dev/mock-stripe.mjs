// A stand-in for Stripe Invoicing (and Formspree, for email alerts) for local testing.
// Invoices get a pretend payment page; clicking "Pay" sends a properly signed
// invoice.paid webhook, just like Stripe would. Emails are printed, not sent.
//
//   node dev/mock-stripe.mjs [port] [webhook url] [webhook secret]

import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.argv[2] || 8789);
const webhookUrl = process.argv[3] || "http://localhost:8787/api/stripe/webhook";
const webhookSecret = process.argv[4] || "whsec_local_mock";

const customers = new Map();
const invoices = new Map();
let invoiceCounter = 1;

const id = (prefix) => `${prefix}_mock${randomBytes(6).toString("hex")}`;
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

// "metadata[enquiry_id]=x" -> { metadata: { enquiry_id: "x" } }
function parseForm(text) {
  const out = {};
  for (const [key, value] of new URLSearchParams(text)) {
    const [head, ...rest] = key.split("[");
    if (!rest.length) out[head] = value;
    else (out[head] ??= {})[rest[0].replace("]", "")] = value;
  }
  return out;
}

async function webhook(type, invoice) {
  const body = JSON.stringify({ id: id("evt"), type, data: { object: invoice } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", webhookSecret).update(`${t}.${body}`).digest("hex");
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${v1}` },
    body,
  }).catch((error) => console.error("webhook failed", error.message));
}

const total = (invoice) => invoice.lines.reduce((sum, line) => sum + line.amount, 0);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;
  const raw = req.method === "POST" ? await readBody(req) : "";

  // Formspree: print the alert it would email.
  const form = path.match(/^\/f\/(.+)$/);
  if (form && req.method === "POST") {
    if (!req.headers.accept?.includes("application/json")) return send(res, 400, { error: "Expected JSON" });
    const alert = JSON.parse(raw || "{}");
    console.log(`\n--- Formspree form ${form[1]} (reply-to ${alert.email || "-"})\nSubject: ${alert._subject}\n\n${alert.message}\n---`);
    return send(res, 200, { ok: true, next: "/thanks" });
  }

  // Pretend hosted invoice page.
  const page = path.match(/^\/i\/(.+)$/);
  if (page) {
    const invoice = invoices.get(page[1]);
    if (!invoice) return send(res, 404, "Not found", "text/plain");
    return send(res, 200, `<!doctype html><meta name="viewport" content="width=device-width"><title>Mock Stripe invoice</title>
<body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem">
<p style="color:#888">MOCK STRIPE (local testing)</p>
<h1>Invoice ${escape(invoice.number)}</h1>
<p>${escape(invoice.lines.map((l) => l.description).join(", "))}</p>
<p style="font-size:2rem">${escape(invoice.currency.toUpperCase())} ${(total(invoice) / 100).toFixed(2)}</p>
<p>Status: <strong>${invoice.status}</strong></p>
${invoice.status === "open" ? `<form method="post" action="/mock/pay/${invoice.id}"><button style="font-size:1.2rem;padding:.6rem 1.5rem">Pay</button></form>` : ""}
</body>`, "text/html");
  }
  const pay = path.match(/^\/mock\/pay\/(.+)$/);
  if (pay && req.method === "POST") {
    const invoice = invoices.get(pay[1]);
    if (invoice?.status === "open") {
      invoice.status = "paid";
      console.log(`paid ${invoice.id}`);
      await webhook("invoice.paid", invoice);
    }
    res.writeHead(303, { Location: `/i/${pay[1]}` });
    return res.end();
  }

  if (!req.headers.authorization?.startsWith("Bearer sk_")) return send(res, 401, { error: { message: "Invalid API key" } });
  const params = parseForm(req.method === "GET" ? url.search.slice(1) : raw);

  if (path === "/v1/customers" && req.method === "GET") {
    return send(res, 200, { data: [...customers.values()].filter((c) => c.email === params.email).slice(0, 1) });
  }
  if (path === "/v1/customers" && req.method === "POST") {
    const customer = { id: id("cus"), email: params.email, name: params.name, metadata: params.metadata || {} };
    customers.set(customer.id, customer);
    return send(res, 200, customer);
  }
  if (path === "/v1/invoices" && req.method === "POST") {
    if (!customers.has(params.customer)) return send(res, 400, { error: { message: "No such customer" } });
    const invoice = { id: id("in"), status: "draft", customer: params.customer, currency: params.currency, description: params.description, metadata: params.metadata || {}, lines: [], number: null, hosted_invoice_url: null };
    invoices.set(invoice.id, invoice);
    return send(res, 200, invoice);
  }
  if (path === "/v1/invoiceitems" && req.method === "POST") {
    const invoice = invoices.get(params.invoice);
    if (!invoice || invoice.status !== "draft") return send(res, 400, { error: { message: "Invoice is not a draft" } });
    const amount = Number(params.amount);
    if (!Number.isInteger(amount) || amount <= 0) return send(res, 400, { error: { message: "Invalid amount" } });
    invoice.lines.push({ amount, description: params.description });
    return send(res, 200, { id: id("ii"), amount });
  }

  const action = path.match(/^\/v1\/invoices\/([^/]+)(?:\/(finalize|send|void))?$/);
  if (action) {
    const invoice = invoices.get(action[1]);
    if (!invoice) return send(res, 404, { error: { message: "No such invoice" } });
    if (action[2] === "finalize") {
      invoice.status = "open";
      invoice.number = `MOCK-${String(invoiceCounter++).padStart(4, "0")}`;
      invoice.hosted_invoice_url = `http://localhost:${port}/i/${invoice.id}`;
      const customer = customers.get(invoice.customer);
      console.log(`invoice ${invoice.number} for ${customer.email}: ${invoice.currency.toUpperCase()} ${(total(invoice) / 100).toFixed(2)}`);
    }
    if (action[2] === "send") console.log(`(Stripe would now email invoice ${invoice.number})`);
    if (action[2] === "void") {
      if (invoice.status !== "open") return send(res, 400, { error: { message: "Only open invoices can be voided" } });
      invoice.status = "void";
    }
    return send(res, 200, invoice);
  }

  send(res, 404, { error: { message: "Not found" } });
}).listen(port, () => console.log(`Mock Stripe + Formspree on http://localhost:${port}`));
