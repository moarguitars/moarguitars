// Is the live site up to date with the latest save? The site publishes /version.json
// (the commit GitHub Pages built, and when); we compare it with the branch's commits.

const DELAYED_AFTER_MS = 10 * 60 * 1000; // Pages normally takes about a minute
const CACHE_MS = 10 * 1000;
let cached = null; // { at, value }

/**
 * { state: "live" | "publishing" | "delayed" | "unknown", liveSince, changes: [{ what, who, date, live }] }
 */
export async function publishStatus(env, gh) {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const [commits, live] = await Promise.all([
    gh.commits(8),
    fetch(`${env.SITE_URL}/version.json?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const builtAt = live?.built ? Date.parse(live.built) : NaN;
  // A commit is live if it's the one Pages built, older than it, or older than the build itself.
  const liveIndex = live?.commit ? commits.findIndex((c) => c.sha === live.commit) : -1;
  const isLive = (commit, index) =>
    (liveIndex !== -1 && index >= liveIndex) ||
    // The build time only has whole seconds, so compare to the second.
    (!Number.isNaN(builtAt) && Math.floor(Date.parse(commit.date) / 1000) * 1000 <= builtAt);

  const changes = commits.map((commit, index) => ({ ...describe(commit.message), date: commit.date, live: isLive(commit, index) }));
  const pending = changes.filter((c) => !c.live);

  let state = "live";
  if (!live) state = "unknown";
  else if (pending.length) {
    const oldestPending = Math.min(...pending.map((c) => Date.parse(c.date)));
    state = Date.now() - oldestPending > DELAYED_AFTER_MS ? "delayed" : "publishing";
  }

  const value = { state, liveSince: live?.built || null, changes };
  cached = { at: Date.now(), value };
  return value;
}

/** Saves made in the admin end with "(admin: name)"; everything else is a code change. */
function describe(message) {
  const firstLine = String(message || "").split("\n")[0];
  const admin = firstLine.match(/^(.*) \(admin: ([^)]+)\)$/);
  if (admin) return { what: admin[1], who: admin[2] };
  return { what: "Website update", who: "developer" };
}

/** Forget the cached status, so a save shows as publishing straight away. */
export function publishStatusChanged() {
  cached = null;
}
