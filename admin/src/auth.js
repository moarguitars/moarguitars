// Username/password login with a signed session cookie.
//
// USERS is a JSON secret mapping usernames to password hashes in the form
// "pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>" (made by `npm run users`).

const COOKIE = "moar_session";
const SESSION_DAYS = 14;
const encoder = new TextEncoder();

export async function login(request, env) {
  const { username = "", password = "" } = await request.json().catch(() => ({}));
  const users = JSON.parse(env.USERS || "{}");
  const name = String(username).trim().toLowerCase();
  // Hash even for unknown users so response time doesn't reveal who exists.
  const stored = users[name] || "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
  const ok = (await verifyPassword(String(password), stored)) && name in users;

  if (!ok) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    throw Object.assign(new Error("Wrong username or password."), { status: 401 });
  }

  const expires = Date.now() + SESSION_DAYS * 864e5;
  const token = await sign({ u: name, exp: expires }, env);
  return {
    user: name,
    cookie: `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`,
  };
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function currentUser(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await hmac(payload, env);
  if (!timingSafeEqual(base64urlToBytes(signature), base64urlToBytes(expected))) return null;

  const session = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)));
  if (session.exp < Date.now()) return null;
  // A user removed from USERS loses access straight away.
  if (!(session.u in JSON.parse(env.USERS || "{}"))) return null;
  return session.u;
}

async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256") return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: Number(iterations) },
    key,
    256,
  );
  return timingSafeEqual(new Uint8Array(bits), base64ToBytes(hash));
}

async function sign(session, env) {
  const payload = bytesToBase64url(encoder.encode(JSON.stringify(session)));
  return `${payload}.${await hmac(payload, env)}`;
}

async function hmac(value, env) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is not set.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value) {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return base64ToBytes(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return new Uint8Array();
  }
}
