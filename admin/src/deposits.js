// Deposits paid online: "Lock in your build" on a guitar opens a Stripe Checkout page
// for that guitar's deposit (set in the admin). When Stripe confirms payment, the deposit
// is recorded in the inbox like an enquiry with a paid payment.

import { readForm } from "./content.js";
import { sendAlert, trackServerEvent } from "./notify.js";
import { stripe } from "./stripe.js";

const NOTICE =
  "This is a non-refundable deposit to lock in your build. It is deducted from the final price; the balance is due on completion.";

/** Public: start a deposit payment. Returns { url } of the Stripe Checkout page. */
export async function startDeposit(env, gh, input) {
  if (input.accepted !== true) throw badRequest("Please accept the deposit rules first.");
  const slug = String(input.guitar || "");
  if (!/^[a-z0-9-]+$/.test(slug)) throw badRequest("Unknown guitar.");

  // The amount always comes from the guitar's saved settings, never from the browser.
  const found = await readForm(gh, slug);
  const guitar = found?.guitar;
  const deposit = Number(guitar?.deposit);
  if (!guitar || !Number.isInteger(deposit) || deposit < 1) throw badRequest("This guitar doesn't take deposits online.");

  const site = env.SITE_URL;
  const anchor = slugify(guitar.title);
  const finalPrice = guitar.price ? ` of ${guitar.price}` : "";
  const checkout = await stripe(env).createCheckout({
    amount: deposit,
    currency: "USD",
    name: `Deposit for ${guitar.title}`,
    description: `Locks in your build. Deducted from the final price${finalPrice}. Non-refundable.`,
    notice: NOTICE,
    successUrl: `${site}/?deposit=paid&guitar=${slug}#${anchor}`,
    cancelUrl: `${site}/?deposit=cancelled&guitar=${slug}#${anchor}`,
    metadata: {
      kind: "deposit",
      guitar: slug,
      guitar_name: guitar.title,
      guitar_price: String(guitar.price || ""),
      analytics_client_id: String(input.analytics_client_id || "").slice(0, 100),
    },
  });
  return { url: checkout.url };
}

/** From Stripe's webhook: a Checkout page was completed. Records paid deposits once. */
export async function recordDeposit(env, session) {
  const meta = session.metadata || {};
  if (meta.kind !== "deposit" || session.payment_status !== "paid") return;

  // Stripe may send the same event more than once.
  const existing = await env.DB.prepare("SELECT id FROM payments WHERE invoice_id = ?").bind(session.id).first();
  if (existing) return;

  const customer = session.customer_details || {};
  const address = customer.address || {};
  const addressText = [address.line1, address.line2, address.postal_code && `${address.postal_code} ${address.city || ""}`.trim(), address.state, address.country]
    .filter(Boolean)
    .join(", ");
  const currency = String(session.currency || "usd").toUpperCase();
  const amount = (Number(session.amount_total || 0) / 100).toFixed(2);
  const now = new Date().toISOString();
  const enquiryId = crypto.randomUUID();
  const answers = [
    { question: "Deposit", answer: `${currency} ${amount} paid online` },
    { question: "Phone", answer: customer.phone || "" },
    { question: "Address", answer: addressText },
  ];

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO enquiries (id, created_at, guitar_slug, guitar_name, guitar_price, name, email, answers, analytics_client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(enquiryId, now, meta.guitar || "", meta.guitar_name || "", meta.guitar_price || "", customer.name || "Unknown", customer.email || "", JSON.stringify(answers), meta.analytics_client_id || ""),
    env.DB.prepare(
      `INSERT INTO payments (id, enquiry_id, created_at, created_by, description, amount, currency, invoice_id, invoice_number, invoice_url, status, paid_at)
       VALUES (?, ?, ?, 'website', ?, ?, ?, ?, ?, '', 'paid', ?)`,
    ).bind(crypto.randomUUID(), enquiryId, now, `Deposit for ${meta.guitar_name}`, amount, currency, session.id, `Online deposit`, now),
  ]);

  await sendAlert(env, {
    subject: `Deposit paid: ${currency} ${amount} for ${meta.guitar_name} from ${customer.name || customer.email}`,
    replyTo: customer.email,
    text: [
      `${customer.name || "Someone"} <${customer.email || "no email"}> paid a ${currency} ${amount} deposit to lock in their ${meta.guitar_name} build.`,
      "",
      `Phone: ${customer.phone || "-"}`,
      `Address: ${addressText || "-"}`,
      "",
      `Open in the admin: ${env.ADMIN_URL || ""}/#enquiry=${enquiryId}`,
    ].join("\n"),
  });

  await trackServerEvent(env, meta.analytics_client_id, "purchase", {
    transaction_id: session.id,
    currency,
    value: Number(amount),
    guitar: meta.guitar_name,
    payment_type: "deposit",
    items: [{ item_id: meta.guitar, item_name: meta.guitar_name, price: Number(amount), quantity: 1 }],
  });
}

function slugify(title) {
  return String(title).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}
