// admin.moarguitars.com: a small editor for the site's content.
// Static files in ./public are the editor UI; /api/* is handled here.

import { changePassword, currentUser, login, logoutCookie } from "./auth.js";
import { startDeposit } from "./deposits.js";
import { github } from "./github.js";
import { insights } from "./insights.js";
import { publishStatus, publishStatusChanged } from "./publish.js";
import { deleteGuitar, isImagePath, readContent, saveGuitar, saveHome, saveOrder } from "./content.js";
import {
  cancelPayment,
  getEnquiry,
  handleStripeWebhook,
  listEnquiries,
  refreshPayment,
  requestPayment,
  submitEnquiry,
  updateEnquiry,
} from "./enquiries.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      // Always revalidate the editor's files so everyone gets updates straight away.
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set("Cache-Control", "no-cache");
      return response;
    }

    // Public endpoints: the site's enquiry form and Stripe's webhook.
    if (url.pathname === "/api/enquiries" && (request.method === "POST" || request.method === "OPTIONS")) {
      return fromSite(request, env, (input) => submitEnquiry(request, env, github(env), input));
    }
    if (url.pathname === "/api/deposits" && (request.method === "POST" || request.method === "OPTIONS")) {
      return fromSite(request, env, (input) => startDeposit(env, github(env), input));
    }
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      const { status, body } = await handleStripeWebhook(request, env);
      return json(body, status);
    }

    try {
      return await handleApi(request, env, url);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

// Public endpoints the site calls from visitors' browsers (enquiries, deposits).
async function fromSite(request, env, handle) {
  // Only the site itself may call these from a browser.
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.SITE_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const cors = allowed.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
  if (request.method === "OPTIONS") return new Response(null, { status: allowed.includes(origin) ? 204 : 403, headers: cors });
  if (!allowed.includes(origin)) return json({ error: "Forbidden" }, 403);

  try {
    const input = await request.json().catch(() => {
      throw Object.assign(new Error("Invalid request."), { status: 400 });
    });
    return json(await handle(input), 200, cors);
  } catch (error) {
    const response = errorResponse(error);
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    return response;
  }
}

function errorResponse(error) {
  // 4xx are messages for the user; 502/503 explain an outside service (GitHub, Stripe) failing.
  const expose = error.status && error.status !== 500;
  if (!expose) console.error(error);
  return json({ error: expose ? error.message : "Something went wrong. Please try again." }, expose ? error.status : 500);
}

async function handleApi(request, env, url) {
  const { method } = request;
  const path = url.pathname;

  // Requests that change things must come from the editor itself (blocks cross-site forms).
  if (method !== "GET" && request.headers.get("X-Moar-Admin") !== "1") return json({ error: "Forbidden" }, 403);

  if (path === "/api/login" && method === "POST") {
    const { user, cookie } = await login(request, env);
    return json({ user }, 200, { "Set-Cookie": cookie });
  }
  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": logoutCookie() });
  }

  const user = await currentUser(request, env);
  const body = () => request.json().catch(() => {
    throw Object.assign(new Error("Invalid request."), { status: 400 });
  });
  if (!user) return json({ error: "Please sign in." }, 401);
  const gh = github(env);

  if (path === "/api/password" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": await changePassword(env, user, await body()) });
  }
  if (path === "/api/me" && method === "GET") {
    return json({ user, siteUrl: env.SITE_URL });
  }
  if (path === "/api/publish-status" && method === "GET") {
    return json(await publishStatus(env, gh));
  }
  // Any content change starts a new publish.
  if (method !== "GET" && /^\/api\/(home|guitars|order)/.test(path)) publishStatusChanged();
  if (path === "/api/insights" && method === "GET") {
    return json(await insights(env, gh, url.searchParams.get("days")));
  }
  if (path === "/api/content" && method === "GET") {
    return json(await readContent(gh));
  }
  if (path === "/api/image" && method === "GET") {
    const image = url.searchParams.get("path");
    if (!isImagePath(image)) return json({ error: "Not found" }, 404);
    const upstream = await gh.raw(image.slice(1));
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType(image),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  if (path === "/api/home" && method === "PUT") {
    await saveHome(gh, await body(), user);
    return json({ ok: true });
  }
  if (path === "/api/guitars" && method === "POST") {
    const slug = await saveGuitar(gh, null, await body(), user, { create: true });
    return json({ slug });
  }
  if (path === "/api/order" && method === "PUT") {
    await saveOrder(gh, await body(), user);
    return json({ ok: true });
  }

  const guitar = path.match(/^\/api\/guitars\/([a-z0-9-]+)$/);
  if (guitar && method === "PUT") {
    await saveGuitar(gh, guitar[1], await body(), user);
    return json({ slug: guitar[1] });
  }
  if (guitar && method === "DELETE") {
    await deleteGuitar(gh, guitar[1], await body(), user);
    return json({ ok: true });
  }

  // Enquiries inbox
  if (path === "/api/enquiries" && method === "GET") {
    return json(await listEnquiries(env, { archived: url.searchParams.get("archived") === "1" }));
  }
  const enquiry = path.match(/^\/api\/enquiries\/([0-9a-f-]{36})(\/payments)?$/);
  if (enquiry && !enquiry[2] && method === "GET") return json(await getEnquiry(env, enquiry[1]));
  if (enquiry && !enquiry[2] && method === "PATCH") return json(await updateEnquiry(env, enquiry[1], await body()));
  if (enquiry && enquiry[2] && method === "POST") return json(await requestPayment(env, enquiry[1], await body(), user));

  const payment = path.match(/^\/api\/payments\/([0-9a-f-]{36})\/(cancel|refresh)$/);
  if (payment && method === "POST") {
    return json(payment[2] === "cancel" ? await cancelPayment(env, payment[1]) : await refreshPayment(env, payment[1]));
  }

  return json({ error: "Not found" }, 404);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function contentType(path) {
  const ext = path.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext];
}
