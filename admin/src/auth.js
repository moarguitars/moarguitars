// Username/password login with a signed session cookie.
//
// USERS is a JSON secret mapping usernames to password hashes in the form
// "pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>" (made by `npm run users`).
// People can change their own password in the admin; that's kept in D1 (user_passwords)
// and used for as long as their USERS hash is unchanged.

const COOKIE = "moar_session";
const SESSION_DAYS = 14;
const ITERATIONS = 100000; // Cloudflare Workers' maximum for PBKDF2
const DUMMY_HASH = "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
const encoder = new TextEncoder();

export async function login(request, env) {
  const { username = "", password = "" } = await request.json().catch(() => ({}));
  const name = String(username).trim().toLowerCase();
  const stored = await passwordHash(env, name);
  // Hash even for unknown users so response time doesn't reveal who exists.
  const ok = (await verifyPassword(String(password), stored || DUMMY_HASH)) && stored !== null;

  if (!ok) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    throw Object.assign(new Error("Wrong username or password."), { status: 401 });
  }
  return { user: name, cookie: await sessionCookie(env, name, stored) };
}

/** Change the signed-in user's password. Returns a fresh cookie; other devices are signed out. */
export async function changePassword(env, user, input) {
  const current = String(input?.current || "");
  const next = String(input?.next || "");
  const stored = await passwordHash(env, user);
  if (!stored || !(await verifyPassword(current, stored))) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    throw Object.assign(new Error("Your current password isn't right."), { status: 400 });
  }
  if (next.length < 10) throw Object.assign(new Error("Use at least 10 characters for the new password."), { status: 400 });
  if (next.length > 200) throw Object.assign(new Error("That password is too long."), { status: 400 });
  if (next === current) throw Object.assign(new Error("The new password is the same as the current one."), { status: 400 });

  const hash = await hashPassword(next);
  const replaces = JSON.parse(env.USERS || "{}")[user];
  await env.DB.prepare(
    `INSERT INTO user_passwords (username, hash, replaces, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (username) DO UPDATE SET hash = excluded.hash, replaces = excluded.replaces, updated_at = excluded.updated_at`,
  )
    .bind(user, hash, replaces, new Date().toISOString())
    .run();
  return sessionCookie(env, user, hash);
}

/** The password hash that applies to a user right now, or null if they can't sign in. */
async function passwordHash(env, name) {
  const base = JSON.parse(env.USERS || "{}")[name];
  if (!base) return null;
  const changed = await env.DB.prepare("SELECT hash, replaces FROM user_passwords WHERE username = ?").bind(name).first();
  return changed && changed.replaces === base ? changed.hash : base;
}

// Sessions carry a fingerprint of the password hash, so changing a password ends
// every other session for that person.
async function sessionCookie(env, name, hash) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const token = await sign({ u: name, exp: expires, pv: (await hmac(hash, env)).slice(0, 16) }, env);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
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
  // A user removed from USERS, or whose password changed, loses access straight away.
  const hash = await passwordHash(env, session.u);
  if (!hash || session.pv !== (await hmac(hash, env)).slice(0, 16)) return null;
  return session.u;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
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
