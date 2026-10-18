// A stand-in for Google's token endpoint and the GA4 Data API, for testing the Insights page.
// It verifies the admin's signed service-account JWT against a local test key, then
// returns sample numbers.
//
//   node dev/mock-google.mjs [port]
//
// First run creates dev/test-service-account.json (git-ignored); put its contents on one
// line in .dev.vars as GA_SERVICE_ACCOUNT='…'.

import { createPublicKey, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.argv[2] || 8790);
const keyFile = new URL("./test-service-account.json", import.meta.url);

if (!existsSync(keyFile)) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync(keyFile, JSON.stringify({
    type: "service_account",
    client_email: "moar-test@local-test.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    token_uri: `http://localhost:${port}/token`,
  }));
  console.log(`Created ${keyFile.pathname}`);
}
const account = JSON.parse(readFileSync(keyFile, "utf8"));
const publicKey = createPublicKey(account.private_key);
const tokens = new Set();

const SAMPLE = {
  // guitar: [select_item, view_item, view_photo opens, enquiry_open, generate_lead, seconds]
  Ella: [14, 120, 64, 18, 6, 9300],
  Wayfair: [9, 85, 40, 7, 2, 5100],
  Offset: [4, 60, 22, 3, 1, 2400],
  Morty: [3, 41, 12, 1, 0, 1500],
  Dolly: [1, 22, 5, 0, 0, 600],
  Bass: [2, 30, 9, 2, 1, 1100],
};
const EVENT_INDEX = { select_item: 0, view_item: 1, view_photo: 2, enquiry_open: 3, generate_lead: 4 };

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const b64urlDecode = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();

  if (req.url === "/token" && req.method === "POST") {
    const params = new URLSearchParams(raw);
    const [header, payload, signature] = (params.get("assertion") || "").split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    const claims = JSON.parse(b64urlDecode(payload || "") || "{}");
    const valid = verifier.verify(publicKey, b64urlDecode(signature || ""))
      && claims.iss === account.client_email
      && claims.scope === "https://www.googleapis.com/auth/analytics.readonly"
      && claims.exp > Date.now() / 1000;
    if (params.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer" || !valid) {
      return send(res, 400, { error: "invalid_grant", error_description: "Invalid JWT signature." });
    }
    const token = `ya29.mock-${randomBytes(8).toString("hex")}`;
    tokens.add(token);
    console.log("issued token for", claims.iss);
    return send(res, 200, { access_token: token, expires_in: 3599, token_type: "Bearer" });
  }

  const report = req.url.match(/^\/v1beta\/properties\/(\d+):runReport$/);
  if (report && req.method === "POST") {
    if (!tokens.has((req.headers.authorization || "").replace("Bearer ", ""))) return send(res, 401, { error: { message: "Request had invalid authentication credentials." } });
    const body = JSON.parse(raw || "{}");
    const days = Number(body.dateRanges?.[0]?.startDate?.replace("daysAgo", "")) || 30;
    const scale = days / 30;
    const dims = (body.dimensions || []).map((d) => d.name);
    const metrics = (body.metrics || []).map((m) => m.name);
    const n = (value) => String(Math.round(value * scale));
    console.log(`report property ${report[1]}: ${dims.join(", ") || "(totals)"} / ${metrics.join(", ")} for ${days} days`);

    if (!dims.length) return send(res, 200, { rows: [{ metricValues: [{ value: n(410) }] }] });
    if (dims.join() === "eventName,customEvent:guitar") {
      const wanted = body.dimensionFilter?.filter?.inListFilter?.values || Object.keys(EVENT_INDEX);
      const rows = [];
      for (const [guitar, values] of Object.entries(SAMPLE)) {
        for (const event of wanted) {
          const value = values[EVENT_INDEX[event]];
          if (!value) continue;
          rows.push({ dimensionValues: [{ value: event }, { value: guitar }], metricValues: [{ value: n(event === "view_photo" ? value * 0.6 : value) }, { value: n(value) }] });
        }
      }
      return send(res, 200, { rows });
    }
    if (dims.join() === "customEvent:guitar") {
      return send(res, 200, { rows: Object.entries(SAMPLE).map(([guitar, v]) => ({ dimensionValues: [{ value: guitar }], metricValues: [{ value: n(v[5]) }] })) });
    }
    return send(res, 400, { error: { message: `Unexpected report: ${dims.join(", ")}` } });
  }

  send(res, 404, { error: { message: "Not found" } });
}).listen(port, () => console.log(`Mock Google (token + GA4 Data API) on http://localhost:${port}`));
