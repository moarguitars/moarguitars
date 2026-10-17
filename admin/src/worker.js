// admin.moarguitars.com: a small editor for the site's content.
// Static files in ./public are the editor UI; /api/* is handled here.

import { currentUser, login, logoutCookie } from "./auth.js";
import { github } from "./github.js";
import { deleteGuitar, isImagePath, readContent, saveGuitar, saveHome, saveOrder } from "./content.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      return await handleApi(request, env, url);
    } catch (error) {
      const status = error.status && error.status < 500 ? error.status : 500;
      if (status === 500) console.error(error);
      return json({ error: status === 500 ? "Something went wrong saving to GitHub. Please try again." : error.message }, status);
    }
  },
};

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

  if (path === "/api/me" && method === "GET") {
    return json({ user, siteUrl: env.SITE_URL });
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
