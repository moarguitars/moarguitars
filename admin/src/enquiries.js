// Enquiries from the site's forms, the admin inbox, and payment requests via Stripe invoices.

import { readForm } from "./content.js";
import { sendAlert, trackServerEvent } from "./notify.js";
import { recordDeposit } from "./deposits.js";
import { stripe, verifyStripeSignature } from "./stripe.js";

const CURRENCIES = ["USD", "EUR", "DKK", "GBP"];
const MAX_PER_HOUR = 5; // enquiries per sender
const FORM_CACHE_MS = 60_000;
const formCache = new Map(); // slug -> { at, value }

// ---------- Public: submit an enquiry ----------

export async function submitEnquiry(request, env, gh, input) {
  // Bots fill in the hidden "website" field; pretend it worked.
  if (input.website) return { ok: true };

  const name = clean(input.name, 120);
  const email = clean(input.email, 200);
  if (!name) throw badRequest("Please add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Please add a valid email address.");

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (env.TURNSTILE_SECRET && !(await passesTurnstile(env, input.turnstile, ip))) {
    throw badRequest("Please complete the spam check and try again.");
  }

  const senderHash = await sha256(`${ip}:${env.SESSION_SECRET}`);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await env.DB.prepare("SELECT COUNT(*) AS count FROM enquiries WHERE sender_hash = ? AND created_at > ?")
    .bind(senderHash, hourAgo)
    .first();
  if (count >= MAX_PER_HOUR) throw Object.assign(new Error("You've sent a few enquiries already. Please email atelier@moarguitars.com instead."), { status: 429 });

  const slug = String(input.guitar || "");
  if (!/^[a-z0-9-]+$/.test(slug)) throw badRequest("Unknown guitar.");
  const found = await cachedForm(gh, slug);
  if (!found) throw badRequest("Unknown guitar.");
  const { guitar, form } = found;

  // Only accept answers to the questions this guitar's form actually asks.
  const given = new Map((Array.isArray(input.answers) ? input.answers : []).map((a) => [String(a?.question), a?.answer]));
  const answers = [];
  for (const field of form.fields || []) {
    let answer = given.get(field.label);
    if (field.type === "checkboxes") {
      answer = (Array.isArray(answer) ? answer : []).map(String).filter((option) => field.options.includes(option));
    } else if (field.type === "select" || field.type === "radio") {
      answer = field.options.includes(String(answer ?? "")) ? String(answer) : "";
    } else {
      answer = clean(answer, field.type === "textarea" ? 4000 : 500);
    }
    const empty = Array.isArray(answer) ? answer.length === 0 : answer === "";
    if (empty && field.required) throw badRequest(`Please answer “${field.label}”.`);
    answers.push({ question: field.label, answer });
  }

  const enquiry = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    guitar_slug: slug,
    guitar_name: guitar.title,
    guitar_price: String(guitar.price || ""),
    name,
    email,
    answers,
  };

  await env.DB.prepare(
    `INSERT INTO enquiries (id, created_at, guitar_slug, guitar_name, guitar_price, name, email, answers, analytics_client_id, sender_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      enquiry.id,
      enquiry.created_at,
      slug,
      guitar.title,
      enquiry.guitar_price,
      name,
      email,
      JSON.stringify(answers),
      clean(input.analytics_client_id, 100),
      senderHash,
    )
    .run();

  const lines = answers.map((a) => `${a.question}\n${Array.isArray(a.answer) ? a.answer.join(", ") || "-" : a.answer || "-"}`);
  await sendAlert(env, {
    subject: slug === "general" ? `New enquiry from ${name}` : `New enquiry: ${guitar.title} from ${name}`,
    replyTo: email,
    text: [slug === "general" ? `${name} <${email}> sent a general enquiry.` : `${name} <${email}> asked about ${guitar.title}.`, "", ...lines.flatMap((line) => [line, ""]), `Open in the admin: ${env.ADMIN_URL || ""}/#enquiry=${enquiry.id}`].join("\n"),
  });

  return { ok: true };
}

// ---------- Admin: inbox ----------

export async function listEnquiries(env, { archived = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.created_at, e.guitar_name, e.name, e.email, e.status,
            (SELECT p.status FROM payments p WHERE p.enquiry_id = e.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
       FROM enquiries e
      WHERE (e.status = 'archived') = ?
      ORDER BY e.created_at DESC
      LIMIT 200`,
  )
    .bind(archived ? 1 : 0)
    .all();
  return results;
}

export async function getEnquiry(env, id) {
  const enquiry = await env.DB.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
  if (!enquiry) throw notFound();
  const { results: payments } = await env.DB.prepare("SELECT * FROM payments WHERE enquiry_id = ? ORDER BY created_at DESC").bind(id).all();
  delete enquiry.sender_hash;
  delete enquiry.analytics_client_id;
  return { ...enquiry, answers: JSON.parse(enquiry.answers), payments };
}

export async function updateEnquiry(env, id, input) {
  const enquiry = await env.DB.prepare("SELECT id FROM enquiries WHERE id = ?").bind(id).first();
  if (!enquiry) throw notFound();
  if (input.status !== undefined) {
    if (!["new", "replied", "archived"].includes(input.status)) throw badRequest("Unknown status.");
    await env.DB.prepare("UPDATE enquiries SET status = ? WHERE id = ?").bind(input.status, id).run();
  }
  if (input.notes !== undefined) {
    await env.DB.prepare("UPDATE enquiries SET notes = ? WHERE id = ?").bind(clean(input.notes, 10000), id).run();
  }
  return getEnquiry(env, id);
}

// ---------- Admin: payment requests ----------

export async function requestPayment(env, id, input, user) {
  const enquiry = await env.DB.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
  if (!enquiry) throw notFound();

  const description = clean(input.description, 120);
  if (!description) throw badRequest("Add a description, e.g. “Deposit for Ella”.");
  const currency = String(input.currency || "").toUpperCase();
  if (!CURRENCIES.includes(currency)) throw badRequest("Choose a currency.");
  const amount = parseAmount(input.amount);
  if (!amount) throw badRequest("Enter an amount, e.g. 1500 or 1500.00.");

  const paymentId = crypto.randomUUID();
  const invoice = await stripe(env).sendInvoice({
    name: enquiry.name,
    email: enquiry.email,
    description,
    amount,
    currency,
    note: clean(input.note, 500),
    metadata: { enquiry_id: id, payment_id: paymentId, guitar: enquiry.guitar_name },
  });

  await env.DB.prepare(
    `INSERT INTO payments (id, enquiry_id, created_at, created_by, description, amount, currency, invoice_id, invoice_number, invoice_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(paymentId, id, new Date().toISOString(), user, description, amount, currency, invoice.id, invoice.number, invoice.url)
    .run();
  if (enquiry.status === "new") await env.DB.prepare("UPDATE enquiries SET status = 'replied' WHERE id = ?").bind(id).run();

  await trackServerEvent(env, enquiry.analytics_client_id, "begin_checkout", {
    currency,
    value: Number(amount),
    guitar: enquiry.guitar_name,
    items: [{ item_id: enquiry.guitar_slug, item_name: enquiry.guitar_name, price: Number(amount) }],
  });

  return getEnquiry(env, id);
}

export async function cancelPayment(env, paymentId) {
  const payment = await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first();
  if (!payment) throw notFound();
  if (payment.status !== "sent") throw badRequest("Only unpaid requests can be cancelled.");
  await stripe(env).voidInvoice(payment.invoice_id);
  await env.DB.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").bind(paymentId).run();
  return getEnquiry(env, payment.enquiry_id);
}

/** Ask Stripe for the latest status of an unpaid request (in case a webhook was missed). */
export async function refreshPayment(env, paymentId) {
  const payment = await env.DB.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first();
  if (!payment) throw notFound();
  if (payment.status === "sent") {
    const invoice = await stripe(env).getInvoice(payment.invoice_id);
    if (invoice.status === "paid") await markPaid(env, payment);
    else if (invoice.status === "void") await env.DB.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").bind(paymentId).run();
  }
  return getEnquiry(env, payment.enquiry_id);
}

/** Stripe calls this when an invoice is paid or voided, or a deposit checkout completes. */
export async function handleStripeWebhook(request, env) {
  const raw = await request.text();
  if (!(await verifyStripeSignature(env, request.headers.get("Stripe-Signature"), raw))) {
    return { status: 400, body: { error: "Invalid signature" } };
  }
  const event = JSON.parse(raw);
  if (event.type === "checkout.session.completed") {
    await recordDeposit(env, event.data?.object || {});
    return { status: 200, body: { received: true } };
  }
  const invoiceId = event.data?.object?.id;
  const payment = invoiceId && (await env.DB.prepare("SELECT * FROM payments WHERE invoice_id = ?").bind(invoiceId).first());
  if (payment) {
    if (event.type === "invoice.paid") await markPaid(env, payment);
    if (event.type === "invoice.voided" && payment.status === "sent") {
      await env.DB.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").bind(payment.id).run();
    }
  }
  return { status: 200, body: { received: true } };
}

async function markPaid(env, payment) {
  // Only the first notification counts (Stripe may retry).
  const { meta } = await env.DB.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'")
    .bind(new Date().toISOString(), payment.id)
    .run();
  if (!meta.changes) return;

  const enquiry = await env.DB.prepare("SELECT * FROM enquiries WHERE id = ?").bind(payment.enquiry_id).first();
  await sendAlert(env, {
    subject: `Paid: ${payment.currency} ${payment.amount} from ${enquiry.name} (${enquiry.guitar_name})`,
    replyTo: enquiry.email,
    text: `${enquiry.name} paid ${payment.currency} ${payment.amount} for “${payment.description}”.\n\nInvoice ${payment.invoice_number}\nOpen in the admin: ${env.ADMIN_URL || ""}/#enquiry=${enquiry.id}`,
  });
  await trackServerEvent(env, enquiry.analytics_client_id, "purchase", {
    transaction_id: payment.invoice_id,
    currency: payment.currency,
    value: Number(payment.amount),
    guitar: enquiry.guitar_name,
    items: [{ item_id: enquiry.guitar_slug, item_name: enquiry.guitar_name, price: Number(payment.amount), quantity: 1 }],
  });
}

// ---------- Helpers ----------

async function cachedForm(gh, slug) {
  const hit = formCache.get(slug);
  if (hit && Date.now() - hit.at < FORM_CACHE_MS) return hit.value;
  const value = await readForm(gh, slug);
  formCache.set(slug, { at: Date.now(), value });
  return value;
}

async function passesTurnstile(env, token, ip) {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", String(token));
  if (ip) body.append("remoteip", ip);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
  return result.success === true;
}

// "1500", "1.500", "1,500.50", "1500,50" -> "1500.00" / "1500.50"
function parseAmount(value) {
  let text = String(value ?? "").replace(/[^\d.,]/g, "");
  const decimal = text.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? text.slice(0, -decimal[0].length) : text).replace(/[.,]/g, "");
  if (!whole || Number(whole) <= 0 || Number(whole) > 1_000_000) return null;
  return `${Number(whole)}.${(decimal ? decimal[1] : "").padEnd(2, "0")}`;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(value, max) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function notFound() {
  return Object.assign(new Error("That enquiry doesn't exist."), { status: 404 });
}
