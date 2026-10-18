// Moar admin: edit the intro, guitars and fine print. Each save is a commit to GitHub,
// and GitHub Pages republishes the site about a minute later.

const app = document.getElementById("app");
const userBox = document.querySelector(".bar-user");

const state = {
  user: null,
  siteUrl: "",
  content: null,
  selected: "inbox", // "inbox" | "form" | "intro" | "fine-print" | "new" | a guitar slug
  dirty: false,
  order: null, // pending guitar order (array of slugs) before it's saved
  enquiryId: null, // open enquiry in the inbox
  showArchived: false,
  insightsDays: 30,
};

// Links in alert emails open an enquiry directly: /#enquiry=<id>
function openLinkedEnquiry() {
  const linked = location.hash.match(/^#enquiry=([0-9a-f-]{36})$/);
  if (!linked) return false;
  state.selected = "inbox";
  state.enquiryId = linked[1];
  history.replaceState(null, "", location.pathname);
  return true;
}
openLinkedEnquiry();
window.addEventListener("hashchange", () => {
  if (openLinkedEnquiry() && state.user && state.content) render();
});

// ---------- API ----------

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "X-Moar-Admin": "1" },
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/login") {
    state.user = null;
    renderLogin("Your session ended. Please sign in again.");
    throw new Error("signed out");
  }
  if (!response.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: response.status });
  return data;
}

// ---------- Tiny DOM helper ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "value") el.value = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

function field(label, input, hint) {
  return h("label", { class: "field" }, h("span", {}, label), input, hint && h("small", {}, hint));
}

function textInput(value, attrs = {}) {
  return h("input", { type: "text", value: value ?? "", oninput: markDirty, ...attrs });
}

function textArea(value, attrs = {}) {
  return h("textarea", { oninput: markDirty, ...attrs }, value ?? "");
}

function markDirty() {
  state.dirty = true;
}

window.addEventListener("beforeunload", (event) => {
  if (state.dirty || state.order) event.preventDefault();
});

// ---------- Start ----------

start();

async function start() {
  try {
    const me = await fetch("/api/me").then((r) => (r.ok ? r.json() : null));
    if (!me) return renderLogin();
    Object.assign(state, { user: me.user, siteUrl: me.siteUrl });
    await loadContent();
  } catch (error) {
    app.replaceChildren(h("p", { class: "status status-error" }, error.message));
  }
}

async function loadContent() {
  app.replaceChildren(h("p", { class: "loading" }, "Loading content…"));
  state.content = await api("GET", "/api/content");
  state.dirty = false;
  state.order = null;
  const slugs = state.content.guitars.map((g) => g.slug);
  if (!["inbox", "insights", "form", "intro", "fine-print", "new", "password", ...slugs].includes(state.selected)) state.selected = "inbox";
  render();
}

// ---------- Login ----------

function renderLogin(message) {
  userBox.hidden = true;
  const status = h("p", { class: "status status-error", role: "alert" }, message || "");
  const button = h("button", { class: "button", type: "submit" }, "Sign in");
  const form = h(
    "form",
    {
      class: "login",
      onsubmit: async (event) => {
        event.preventDefault();
        button.disabled = true;
        status.textContent = "";
        const data = new FormData(form);
        try {
          await api("POST", "/api/login", { username: data.get("username"), password: data.get("password") });
          await start();
        } catch (error) {
          status.textContent = error.message;
          button.disabled = false;
        }
      },
    },
    h("h1", {}, "Sign in"),
    field("Username", h("input", { type: "text", name: "username", autocomplete: "username", autocapitalize: "none", required: true })),
    field("Password", h("input", { type: "password", name: "password", autocomplete: "current-password", required: true })),
    button,
    status,
  );
  app.replaceChildren(form);
  form.querySelector("input").focus();
}

async function logout() {
  if ((state.dirty || state.order) && !confirm("You have unsaved changes. Sign out anyway?")) return;
  await api("POST", "/api/logout");
  state.dirty = false;
  state.order = null;
  renderLogin();
}

// ---------- Main layout ----------

function render() {
  userBox.hidden = false;
  userBox.replaceChildren(
    h("a", { href: state.siteUrl, target: "_blank", rel: "noopener" }, "View site"),
    h("span", {}, state.user),
    h("button", { class: "link-button", type: "button", onclick: () => select("password") }, "Change password"),
    h("button", { class: "button button-quiet button-small", onclick: logout }, "Sign out"),
  );
  app.replaceChildren(h("div", { class: "layout" }, renderNav(), renderEditor()));
}

function select(key) {
  if (key === "inbox") state.enquiryId = null;
  if (key === state.selected && key !== "inbox") return;
  if (state.dirty && !confirm("You have unsaved changes. Discard them?")) return;
  state.dirty = false;
  state.selected = key;
  render();
  window.scrollTo({ top: 0 });
}

function navLink(key, label) {
  return h("button", { class: "nav-link", "aria-current": String(state.selected === key), onclick: () => select(key) }, label);
}

function guitarsInOrder() {
  const { guitars } = state.content;
  if (!state.order) return guitars;
  return state.order.map((slug) => guitars.find((g) => g.slug === slug));
}

function renderNav() {
  const guitars = guitarsInOrder();
  const move = (index, delta) => {
    const order = guitars.map((g) => g.slug);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    state.order = order;
    render();
  };

  return h(
    "nav",
    { class: "nav", "aria-label": "Sections" },
    h("h2", {}, "Enquiries"),
    h("ul", {},
      h("li", {}, navLink("inbox", "Inbox")),
      h("li", {}, navLink("insights", "Insights")),
      h("li", {}, navLink("form", "Enquiry form")),
    ),
    h("h2", {}, "Top of page"),
    h("ul", {}, h("li", {}, navLink("intro", state.content.home.intro_title || "Intro"))),
    h("h2", {}, "Guitars"),
    h(
      "ul",
      {},
      guitars.map((guitar, index) =>
        h(
          "li",
          {},
          navLink(guitar.slug, guitar.title),
          h("button", { class: "icon-button", "aria-label": `Move ${guitar.title} up`, disabled: index === 0, onclick: () => move(index, -1) }, "↑"),
          h("button", { class: "icon-button", "aria-label": `Move ${guitar.title} down`, disabled: index === guitars.length - 1, onclick: () => move(index, 1) }, "↓"),
        ),
      ),
      h("li", {}, navLink("new", "+ Add a guitar")),
    ),
    state.order && renderOrderActions(),
    h("h2", {}, "Bottom of page"),
    h("ul", {}, h("li", {}, navLink("fine-print", state.content.home.fine_print_title || "Fine Print"))),
  );
}

function renderOrderActions() {
  const save = h("button", { class: "button button-small" }, "Save order");
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const order = state.order.map((slug) => ({ slug, sha: state.content.guitars.find((g) => g.slug === slug).sha }));
      await api("PUT", "/api/order", { order });
      await loadContent();
      savedToast("New order saved");
    } catch (error) {
      showError(error);
      save.disabled = false;
    }
  });
  const cancel = h("button", { class: "button button-quiet button-small", onclick: () => { state.order = null; render(); } }, "Cancel");
  return h("div", { class: "order-actions" }, save, cancel);
}

function renderEditor() {
  if (state.selected === "inbox") return inboxView();
  if (state.selected === "password") return passwordEditor();
  if (state.selected === "insights") return insightsView();
  if (state.selected === "form") return defaultFormEditor();
  if (state.selected === "intro") return introEditor();
  if (state.selected === "fine-print") return finePrintEditor();
  if (state.selected === "new") return guitarEditor(null);
  return guitarEditor(state.content.guitars.find((g) => g.slug === state.selected));
}

// Shared save button.
function saveBar(onSave, extra) {
  const button = h("button", { class: "button", type: "submit" }, "Save");
  const run = async () => {
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      await onSave();
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.textContent = "Save";
    }
  };
  return { bar: h("div", { class: "actions" }, button, extra), run };
}

// ---------- Notifications (top of the page) ----------

const toasts = document.body.appendChild(h("div", { class: "toasts", "aria-live": "assertive" }));

function toast(message, { type = "ok", action } = {}) {
  toasts.replaceChildren();
  const close = () => {
    note.classList.add("toast-leaving");
    setTimeout(() => note.remove(), 250);
  };
  const note = h("div", { class: `toast toast-${type}`, role: type === "error" ? "alert" : "status" },
    h("span", { class: "toast-icon", "aria-hidden": "true" }, type === "error" ? "!" : "✓"),
    h("span", { class: "toast-message" }, message),
    action,
    h("button", { class: "toast-close", type: "button", "aria-label": "Dismiss", onclick: close }, "✕"),
  );
  toasts.append(note);
  // Successes fade away on their own; errors stay until dismissed.
  if (type === "ok") setTimeout(close, 6000);
}

function savedToast(what = "Saved") {
  toast(`${what}. The live site updates in about a minute.`, {
    action: h("a", { class: "toast-action", href: state.siteUrl, target: "_blank", rel: "noopener" }, "View site"),
  });
}

function showError(error) {
  if (error.message === "signed out") return;
  const reload = error.status === 409 &&
    h("button", { class: "toast-action", type: "button", onclick: () => { state.dirty = false; toasts.replaceChildren(); loadContent(); } }, "Reload");
  toast(error.message, { type: "error", action: reload });
}

// ---------- Intro ----------

function introEditor() {
  const home = state.content.home;
  const inputs = {
    intro_title: textInput(home.intro_title, { required: true, maxlength: 60 }),
    intro: textArea(home.intro, { rows: 8 }),
    reach_out_label: textInput(home.reach_out_label, { maxlength: 60 }),
  };

  const { bar, run } = saveBar(async () => {
    const updated = { ...home };
    for (const [key, input] of Object.entries(inputs)) updated[key] = input.value;
    await api("PUT", "/api/home", { home: updated, sha: state.content.homeSha });
    await loadContent();
    savedToast();
  });

  return h(
    "form",
    { class: "editor", onsubmit: (e) => { e.preventDefault(); run(); } },
    h("h1", {}, "Intro"),
    h("p", { class: "help" }, "The text at the top of the page, under the logo."),
    field("Title", inputs.intro_title),
    field("Text", inputs.intro, "Leave a blank line between paragraphs."),
    field("Contact link text", inputs.reach_out_label, "Opens the contact form, which asks the default enquiry questions. Answers arrive in the inbox as “General enquiry”."),
    bar,
  );
}

// ---------- Insights ----------

function insightsView() {
  const box = h("div", { class: "editor insights" }, h("p", { class: "loading" }, "Loading insights…"));
  api("GET", `/api/insights?days=${state.insightsDays}`)
    .then((data) => renderInsights(box, data))
    .catch((error) => {
      showError(error);
      box.replaceChildren(h("p", { class: "status status-error" }, "Couldn't load insights."));
    });
  return box;
}

function renderInsights(box, data) {
  const ga = data.analytics;
  const hasGa = ga.configured && !ga.error;
  const num = (n) => (n === null || n === undefined ? "–" : Number(n).toLocaleString());
  const money = (totals) =>
    Object.entries(totals).map(([currency, amount]) => `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join(" + ");
  const duration = (seconds) => {
    if (!seconds) return "–";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  };
  const maxSeen = Math.max(1, ...data.guitars.map((g) => g.ga?.priceSeen || 0));

  const periods = h("div", { class: "segmented", role: "group", "aria-label": "Period" },
    [7, 30, 90].map((days) =>
      h("button", {
        type: "button",
        "aria-pressed": String(data.days === days),
        onclick: () => { state.insightsDays = days; render(); },
      }, `${days} days`),
    ),
  );

  const stat = (label, value, note) =>
    h("div", { class: "stat" }, h("span", { class: "stat-value" }, value), h("span", { class: "stat-label" }, label), note && h("span", { class: "stat-note" }, note));

  const gaNotice = !ga.configured
    ? h("div", { class: "notice" },
        h("strong", {}, "Google Analytics isn't connected yet. "),
        "The columns marked “Analytics” fill in once the admin has read access to Google Analytics (see the setup steps in the admin README). Inbox numbers below are already live.")
    : ga.error && h("div", { class: "notice notice-error" }, h("strong", {}, "Google Analytics: "), ga.error);

  const head = (label, source) => h("th", { scope: "col" }, label, source && h("span", { class: `source source-${source}` }, source === "ga" ? "Analytics" : "Inbox"));

  const rows = data.guitars.map((g) => {
    const a = g.ga || {};
    const rate = hasGa && a.priceSeen ? Math.round(((a.enquired || 0) / a.priceSeen) * 100) : null;
    const budgets = Object.entries(g.budgets);
    return h("tr", {},
      h("th", { scope: "row" }, g.name, !g.onSite && h("span", { class: "muted" }, " (no longer on site)")),
      h("td", { class: "num" },
        h("span", { class: "meter", style: `--w:${hasGa ? Math.round(((a.priceSeen || 0) / maxSeen) * 100) : 0}%` }),
        hasGa ? num(a.priceSeen || 0) : "–"),
      h("td", { class: "num" }, hasGa ? num(a.photos || 0) : "–"),
      h("td", { class: "num" }, hasGa && ga.engagementAvailable && a.priceSeen ? duration((a.seconds || 0) / Math.max(1, a.priceSeen)) : "–"),
      h("td", { class: "num" }, hasGa ? num(a.formOpened || 0) : "–"),
      h("td", { class: "num" }, rate === null ? "–" : `${rate}%`),
      h("td", { class: "num strong" }, num(g.enquiries)),
      h("td", { class: "num" }, num(g.invoiced)),
      h("td", { class: "num" }, g.paid ? h("span", { class: "badge badge-paid" }, `${g.paid} · ${money(g.paidTotals)}`) : "0"),
      h("td", { class: "budgets" }, budgets.length ? budgets.map(([label, count]) => h("span", { class: "chip" }, `${label}${count > 1 ? ` ×${count}` : ""}`)) : h("span", { class: "muted" }, "–")),
    );
  });

  const maxVisitors = Math.max(1, ...data.countries.map((c) => c.ga?.visitors || 0));
  const countryRows = data.countries.map((c) => {
    const a = c.ga || {};
    return h("tr", {},
      h("th", { scope: "row" }, c.name, c.code && h("span", { class: "muted" }, ` ${c.code}`)),
      h("td", { class: "num" },
        h("span", { class: "meter", style: `--w:${hasGa ? Math.round(((a.visitors || 0) / maxVisitors) * 100) : 0}%` }),
        hasGa ? num(a.visitors || 0) : "–"),
      h("td", { class: "num" }, hasGa ? num(a.opened || 0) : "–"),
      h("td", { class: "num strong" }, num(c.enquiries)),
      h("td", { class: "num" }, num(c.invoiced)),
      h("td", { class: "num" }, c.paid ? h("span", { class: "badge badge-paid" }, `${c.paid} · ${money(c.paidTotals)}`) : "0"),
    );
  });
  const countryNotice = ga.countriesError && h("div", { class: "notice notice-error" }, h("strong", {}, "Google Analytics (countries): "), ga.countriesError);

  box.replaceChildren(...[
    h("div", { class: "inbox-head" }, h("h1", {}, "Insights"), periods),
    h("p", { class: "help" }, `Last ${data.days} days, per guitar: who looked, who asked, who paid.`),
    gaNotice,
    h("div", { class: "stats" },
      stat("Visitors", hasGa ? num(ga.visitors) : "–", "Analytics"),
      stat("Enquiries", num(data.totals.enquiries), data.general?.enquiries ? `incl. ${data.general.enquiries} general` : "Inbox"),
      stat("Invoices sent", num(data.totals.invoiced), "Inbox"),
      stat("Paid", num(data.totals.paid), "Inbox"),
    ),
    h("div", { class: "table-wrap" },
      h("table", { class: "insights-table" },
        h("thead", {}, h("tr", {},
          head("Guitar"),
          head("Opened", "ga"),
          head("Photos opened", "ga"),
          head("Avg. time", "ga"),
          head("Opened form", "ga"),
          head("Enquiry rate", "ga"),
          head("Enquiries", "inbox"),
          head("Invoiced", "inbox"),
          head("Paid", "inbox"),
          head("Budgets given", "inbox"),
        )),
        h("tbody", {}, rows),
      ),
    ),
    h("h2", {}, "By country"),
    h("p", { class: "help" }, `Last ${data.days} days, per visitor country. Inbox countries come from the connection each enquiry was sent from.`),
    countryNotice,
    data.countries.length === 0
      ? h("p", { class: "help muted" }, "No visitors or enquiries in this period yet.")
      : h("div", { class: "table-wrap" },
          h("table", { class: "insights-table" },
            h("thead", {}, h("tr", {},
              head("Country"),
              head("Visitors", "ga"),
              head("Opened a guitar", "ga"),
              head("Enquiries", "inbox"),
              head("Invoiced", "inbox"),
              head("Paid", "inbox"),
            )),
            h("tbody", {}, countryRows),
          ),
        ),
    h("p", { class: "help footnote" },
      "Analytics columns only count visitors who accepted cookies, and Google Analytics can lag a day behind. ",
      "Opened means they clicked Description and pricing (or followed a link to the guitar), which shows the price. Enquiry rate is the share of those who then sent its form. ",
      "Inbox columns are exact. Enquiries sent before countries were recorded show as Unknown."),
  ].filter(Boolean));
}

// ---------- Change password ----------

function passwordEditor() {
  const input = (autocomplete) => h("input", { type: "password", autocomplete, required: true, maxlength: 200 });
  const current = input("current-password");
  const next = input("new-password");
  const repeat = input("new-password");

  const { bar, run } = saveBar(async () => {
    if (next.value.length < 10) throw new Error("Use at least 10 characters for the new password.");
    if (next.value !== repeat.value) throw new Error("The two new passwords don’t match.");
    await api("POST", "/api/password", { current: current.value, next: next.value });
    state.dirty = false;
    state.selected = "inbox";
    render();
    toast("Password changed. You’re still signed in here; other devices will need the new password.");
  });

  return h(
    "form",
    { class: "editor", onsubmit: (e) => { e.preventDefault(); run(); } },
    h("h1", {}, "Change password"),
    h("p", { class: "help" }, `Signed in as ${state.user}. Changing your password signs you out on your other devices.`),
    field("Current password", current),
    field("New password", next, "At least 10 characters. A few random words works well."),
    field("New password again", repeat),
    bar,
  );
}

// ---------- Enquiries inbox ----------

const STATUS_LABELS = { new: "New", replied: "Replied", archived: "Archived" };
const PAYMENT_LABELS = { sent: "Payment requested", paid: "Paid", cancelled: "Request cancelled" };

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const countryNames = new Intl.DisplayNames([navigator.language || "en", "en"], { type: "region" });

// "US" -> "United States"; '' (older enquiries, local testing) -> null.
function countryName(code) {
  if (!code) return null;
  try {
    return countryNames.of(code) || code;
  } catch {
    return code;
  }
}

function badge(text, kind) {
  return h("span", { class: `badge badge-${kind}` }, text);
}

function inboxView() {
  const box = h("div", { class: "editor" }, h("p", { class: "loading" }, "Loading enquiries…"));
  (state.enquiryId ? renderEnquiry(box, state.enquiryId) : renderInbox(box)).catch((error) => {
    showError(error);
    box.replaceChildren(h("p", { class: "status status-error" }, "Couldn't load enquiries."));
  });
  return box;
}

async function renderInbox(box) {
  const enquiries = await api("GET", `/api/enquiries${state.showArchived ? "?archived=1" : ""}`);
  const toggle = h("div", { class: "order-actions" },
    h("button", { type: "button", class: "button button-quiet button-small", onclick: () => render() }, "Refresh"),
    h("button", {
      type: "button",
      class: "button button-quiet button-small",
      onclick: () => { state.showArchived = !state.showArchived; render(); },
    }, state.showArchived ? "Back to inbox" : "Show archived"),
  );

  box.replaceChildren(
    h("div", { class: "inbox-head" }, h("h1", {}, state.showArchived ? "Archived" : "Inbox"), toggle),
    enquiries.length === 0
      ? h("p", { class: "help" }, state.showArchived ? "Nothing archived." : "No enquiries yet. They’ll appear here when someone fills in a form on the site.")
      : h("ul", { class: "inbox" },
          enquiries.map((e) =>
            h("li", {},
              h("button", {
                type: "button",
                class: `inbox-row${e.status === "new" ? " inbox-row-new" : ""}`,
                onclick: () => { state.enquiryId = e.id; render(); },
              },
                h("span", { class: "inbox-name" }, e.name),
                h("span", { class: "inbox-guitar" }, e.guitar_name, e.country && h("span", { class: "inbox-country" }, ` · ${countryName(e.country)}`)),
                h("span", { class: "inbox-meta" },
                  e.status === "new" && badge("New", "new"),
                  e.payment_status && badge(PAYMENT_LABELS[e.payment_status], e.payment_status),
                  h("time", { datetime: e.created_at }, formatDate(e.created_at)),
                ),
              ),
            ),
          ),
        ),
  );
}

async function renderEnquiry(box, id) {
  const e = await api("GET", `/api/enquiries/${id}`);
  // Opening a new enquiry doesn't change its status; replying or requesting payment does.

  const reload = async (promise, message) => {
    try {
      await promise;
      if (message) toast(message);
      render();
    } catch (error) {
      showError(error);
    }
  };
  const setStatus = (status, message) => reload(api("PATCH", `/api/enquiries/${id}`, { status }), message);

  const notes = textArea(e.notes, { rows: 3, placeholder: "Private notes for the team" });
  const saveNotes = h("button", {
    type: "button",
    class: "button button-quiet button-small",
    onclick: async () => {
      try {
        await api("PATCH", `/api/enquiries/${id}`, { notes: notes.value });
        state.dirty = false;
        toast("Notes saved.");
      } catch (error) {
        showError(error);
      }
    },
  }, "Save notes");

  const answer = (value) => (Array.isArray(value) ? value.join(", ") : value) || h("span", { class: "muted" }, "No answer");

  box.replaceChildren(
    h("button", { type: "button", class: "back", onclick: () => { state.enquiryId = null; render(); } }, "← All enquiries"),
    h("h1", {}, e.name),
    h("p", { class: "enquiry-meta" },
      h("strong", {}, e.guitar_name), e.guitar_price && ` · listed at ${e.guitar_price}`, " · ", formatDate(e.created_at), " ",
      badge(STATUS_LABELS[e.status], e.status),
    ),
    h("div", { class: "enquiry-actions" },
      h("a", {
        class: "button",
        href: `mailto:${e.email}?subject=${encodeURIComponent(`Your ${e.guitar_name} enquiry`)}`,
        onclick: () => { if (e.status === "new") setStatus("replied"); },
      }, `Reply to ${e.email}`),
      e.status === "new" && h("button", { type: "button", class: "button button-quiet", onclick: () => setStatus("replied", "Marked as replied.") }, "Mark as replied"),
      e.status !== "archived"
        ? h("button", { type: "button", class: "button button-quiet", onclick: () => { state.enquiryId = null; setStatus("archived", "Archived."); } }, "Archive")
        : h("button", { type: "button", class: "button button-quiet", onclick: () => setStatus("replied", "Moved back to the inbox.") }, "Move to inbox"),
    ),
    h("dl", { class: "answers" },
      h("dt", {}, "Email"), h("dd", {}, e.email),
      h("dt", {}, "Country"), h("dd", {}, e.country ? `${countryName(e.country)} (${e.country})` : h("span", { class: "muted" }, "Unknown")),
      e.answers.flatMap((a) => [h("dt", {}, a.question), h("dd", {}, answer(a.answer))]),
    ),
    h("fieldset", {}, h("legend", {}, "Notes"), notes, h("div", { class: "order-actions" }, saveNotes)),
    h("fieldset", {}, h("legend", {}, "Payments"), paymentsSection(e, reload)),
  );
}

function paymentsSection(e, reload) {
  const rows = e.payments.map((p) =>
    h("div", { class: "payment" },
      h("div", { class: "payment-main" },
        h("strong", {}, `${p.currency} ${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`),
        " ", p.description, " ",
        badge(PAYMENT_LABELS[p.status], p.status),
      ),
      h("div", { class: "payment-meta" },
        `Invoice ${p.invoice_number} · requested by ${p.created_by} ${formatDate(p.created_at)}`,
        p.paid_at && ` · paid ${formatDate(p.paid_at)}`,
      ),
      p.status === "sent" && h("div", { class: "order-actions" },
        p.invoice_url && h("a", { class: "button button-quiet button-small", href: p.invoice_url, target: "_blank", rel: "noopener" }, "View invoice"),
        p.invoice_url && h("button", {
          type: "button",
          class: "button button-quiet button-small",
          onclick: async () => {
            await navigator.clipboard.writeText(p.invoice_url);
            toast("Payment link copied.");
          },
        }, "Copy link"),
        h("button", { type: "button", class: "button button-quiet button-small", onclick: () => reload(api("POST", `/api/payments/${p.id}/refresh`), "Status updated.") }, "Check status"),
        h("button", {
          type: "button",
          class: "button button-quiet button-small",
          onclick: () => {
            if (confirm(`Cancel this payment request? The invoice link stops working; Stripe doesn’t email ${e.name} about it, so let them know.`)) reload(api("POST", `/api/payments/${p.id}/cancel`), "Payment request cancelled.");
          },
        }, "Cancel request"),
      ),
    ),
  );

  const description = textInput(`Deposit for ${e.guitar_name}`, { maxlength: 120 });
  const amount = textInput("", { inputmode: "decimal", placeholder: "1500", maxlength: 12 });
  const currency = h("select", {}, ["USD", "EUR", "DKK", "GBP"].map((c) => h("option", { value: c }, c)));
  const note = textArea("", { rows: 2, placeholder: "Optional message shown on the invoice" });
  const send = h("button", { type: "submit", class: "button" }, "Send invoice");

  const form = h("form", {
    class: "request-payment",
    onsubmit: async (event) => {
      event.preventDefault();
      if (!amount.value.trim()) return toast("Enter an amount.", { type: "error" });
      if (!confirm(`Email ${e.name} a Stripe invoice for ${currency.value} ${amount.value}?`)) return;
      send.disabled = true;
      send.textContent = "Sending…";
      try {
        await api("POST", `/api/enquiries/${e.id}/payments`, {
          description: description.value,
          amount: amount.value,
          currency: currency.value,
          note: note.value,
        });
        state.dirty = false;
        toast(`Invoice sent to ${e.email}. You’ll see “Paid” here once it’s paid.`);
        render();
      } catch (error) {
        showError(error);
        send.disabled = false;
        send.textContent = "Send invoice";
      }
    },
  },
    h("h3", {}, "Request a payment"),
    field("What it's for", description),
    h("div", { class: "row row-amount" }, field("Amount", amount), field("Currency", currency)),
    field("Message", note),
    h("p", { class: "help" }, `Stripe emails the invoice to ${e.email}. They pay on Stripe’s secure page by card, Apple Pay or Google Pay. It’s due within 14 days.`),
    send,
  );

  return h("div", {}, rows.length ? rows : h("p", { class: "help" }, "No payments requested yet."), form);
}

// ---------- Enquiry forms ----------

const FIELD_TYPES = [
  ["text", "Short answer"],
  ["textarea", "Long answer"],
  ["select", "Dropdown"],
  ["radio", "Multiple choice (pick one)"],
  ["checkboxes", "Checkboxes (pick any)"],
];
const CHOICE_TYPES = ["select", "radio", "checkboxes"];

// An editor for one form. Returns the element and a function that reads its current value.
function formBuilder(initial) {
  const form = structuredClone(initial || { fields: [] });
  form.fields ??= [];
  const box = h("div");

  const intro = textArea(form.intro, { rows: 2 });
  const submitLabel = textInput(form.submit_label || "Send enquiry", { maxlength: 60 });
  const thanks = textArea(form.thanks, { rows: 2 });

  const move = (index, delta) => {
    const list = form.fields;
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    markDirty();
    draw();
  };

  function draw() {
    box.replaceChildren(
      h("div", { class: "list-item list-item-fixed" },
        h("p", { class: "fixed-fields" }, h("strong", {}, "Name"), " and ", h("strong", {}, "Email"), " are always asked first."),
      ),
      ...form.fields.map((question, index) => {
        const label = textInput(question.label, { maxlength: 120, placeholder: "Your question" });
        label.addEventListener("input", () => { question.label = label.value; });

        const type = h("select", { onchange: () => { question.type = type.value; markDirty(); draw(); } },
          FIELD_TYPES.map(([value, name]) => h("option", { value, selected: (question.type || "text") === value }, name)),
        );

        const requiredBox = h("input", { type: "checkbox", checked: !!question.required, onchange: () => { question.required = requiredBox.checked; markDirty(); } });
        const help = textInput(question.help, { maxlength: 200, placeholder: "Optional hint under the question" });
        help.addEventListener("input", () => { question.help = help.value; });

        const isChoice = CHOICE_TYPES.includes(question.type);
        const options = isChoice && textArea((question.options || []).join("\n"), { rows: 4 });
        if (options) options.addEventListener("input", () => { question.options = options.value.split("\n"); });

        return h("div", { class: "list-item" },
          h("div", { class: "list-item-tools" },
            h("button", { type: "button", class: "icon-button", "aria-label": "Move up", disabled: index === 0, onclick: () => move(index, -1) }, "↑"),
            h("button", { type: "button", class: "icon-button", "aria-label": "Move down", disabled: index === form.fields.length - 1, onclick: () => move(index, 1) }, "↓"),
            h("button", { type: "button", class: "icon-button", "aria-label": "Remove question", onclick: () => { form.fields.splice(index, 1); markDirty(); draw(); } }, "✕"),
          ),
          field(`Question ${index + 1}`, label),
          h("div", { class: "row row-type" },
            field("Answer type", type),
            h("label", { class: "field checkbox-field" }, requiredBox, h("span", {}, "Required")),
          ),
          options && field("Options", options, "One per line."),
          field("Hint", help),
        );
      }),
      h("button", {
        type: "button",
        class: "button button-quiet button-small",
        onclick: () => { form.fields.push({ label: "", type: "text" }); markDirty(); draw(); },
      }, "+ Add a question"),
    );
  }
  draw();

  const element = h("div", { class: "form-builder" },
    field("Intro", intro, "Shown above the questions."),
    box,
    h("div", { class: "row" },
      field("Button text", submitLabel),
      field("After sending", thanks, "The message people see once their enquiry is sent."),
    ),
  );

  return {
    element,
    value: () => ({ ...form, intro: intro.value, submit_label: submitLabel.value, thanks: thanks.value }),
  };
}

function defaultFormEditor() {
  const home = state.content.home;
  const enquireLabel = textInput(home.enquire_label || "Enquire", { maxlength: 60 });
  const builder = formBuilder(home.enquiry_form);

  const { bar, run } = saveBar(async () => {
    const updated = { ...home, enquire_label: enquireLabel.value, enquiry_form: builder.value() };
    await api("PUT", "/api/home", { home: updated, sha: state.content.homeSha });
    await loadContent();
    savedToast();
  });

  return h(
    "form",
    { class: "editor", onsubmit: (e) => { e.preventDefault(); run(); } },
    h("h1", {}, "Enquiry form"),
    h("p", { class: "help" }, "The questions people answer when they click Enquire under a guitar. Any guitar can have its own questions instead (set on the guitar)."),
    field("Link text under each guitar", enquireLabel),
    builder.element,
    bar,
  );
}

// ---------- Fine print ----------

function finePrintEditor() {
  const home = state.content.home;
  const title = textInput(home.fine_print_title, { required: true, maxlength: 60 });
  const items = structuredClone(home.fine_print || []);
  const contacts = structuredClone(home.contact || []);

  const itemsBox = h("div");
  const contactsBox = h("div");

  // A small editable list with move up/down and remove.
  function listEditor(box, list, fields, blank, addLabel) {
    const draw = () => {
      box.replaceChildren(
        ...list.map((item, index) =>
          h("div", { class: "list-item" },
            h("div", { class: "list-item-tools" },
              h("button", { type: "button", class: "icon-button", "aria-label": "Move up", disabled: index === 0, onclick: () => { [list[index - 1], list[index]] = [list[index], list[index - 1]]; markDirty(); draw(); } }, "↑"),
              h("button", { type: "button", class: "icon-button", "aria-label": "Move down", disabled: index === list.length - 1, onclick: () => { [list[index + 1], list[index]] = [list[index], list[index + 1]]; markDirty(); draw(); } }, "↓"),
              h("button", { type: "button", class: "icon-button", "aria-label": "Remove", onclick: () => { list.splice(index, 1); markDirty(); draw(); } }, "✕"),
            ),
            fields.map(([key, label, multiline, hint]) => {
              const input = multiline ? textArea(item[key], { rows: 3 }) : textInput(item[key]);
              input.addEventListener("input", () => { item[key] = input.value; });
              return field(label, input, hint);
            }),
          ),
        ),
        h("button", { type: "button", class: "button button-quiet button-small", onclick: () => { list.push({ ...blank }); markDirty(); draw(); } }, addLabel),
      );
    };
    draw();
  }

  listEditor(itemsBox, items, [["label", "Heading"], ["body", "Text", true, "Shown when someone clicks the heading."]], { label: "", body: "" }, "+ Add an item");
  listEditor(contactsBox, contacts, [["label", "Label"], ["link", "Link", false, "mailto:…, https://… or https://wa.me/<number>"]], { label: "", link: "" }, "+ Add a link");

  const { bar, run } = saveBar(async () => {
    const updated = { ...home, fine_print_title: title.value, fine_print: items, contact: contacts };
    await api("PUT", "/api/home", { home: updated, sha: state.content.homeSha });
    await loadContent();
    savedToast();
  });

  return h(
    "form",
    { class: "editor", onsubmit: (e) => { e.preventDefault(); run(); } },
    h("h1", {}, "Fine Print"),
    field("Title", title),
    h("fieldset", {}, h("legend", {}, "Items"), itemsBox),
    h("fieldset", {}, h("legend", {}, "Contact links"), contactsBox),
    bar,
  );
}

// ---------- Guitar ----------

function guitarEditor(guitar) {
  const isNew = !guitar;
  guitar ??= { title: "", price: "", price_note: "All prices in USD. Shipping and local taxes are added at checkout.", body: "", images: [] };

  const inputs = {
    title: textInput(guitar.title, { required: true, maxlength: 60 }),
    price: textInput(guitar.price, { maxlength: 40, placeholder: "$ 15.000" }),
    price_note: textInput(guitar.price_note, { maxlength: 200 }),
    body: textArea(guitar.body, { rows: 10 }),
  };

  // Photos: existing ones are { path }, new ones are { upload: { data }, preview }.
  const photos = guitar.images.map((path) => ({ path }));
  const photosBox = h("div", { class: "photos" });

  const drawPhotos = () => {
    photosBox.replaceChildren(
      ...photos.map((photo, index) =>
        h("div", { class: `photo${photo.upload ? " photo-new" : ""}` },
          h("img", { src: photo.preview || `/api/image?path=${encodeURIComponent(photo.path)}`, alt: `Photo ${index + 1}`, loading: "lazy" }),
          h("div", { class: "photo-tools" },
            h("button", { type: "button", class: "icon-button", "aria-label": "Move left", disabled: index === 0, onclick: () => { [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; markDirty(); drawPhotos(); } }, "←"),
            h("button", { type: "button", class: "icon-button", "aria-label": "Remove photo", onclick: () => { photos.splice(index, 1); markDirty(); drawPhotos(); } }, "✕"),
            h("button", { type: "button", class: "icon-button", "aria-label": "Move right", disabled: index === photos.length - 1, onclick: () => { [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; markDirty(); drawPhotos(); } }, "→"),
          ),
        ),
      ),
      photos.length < 12 &&
        h("label", { class: "photo-add" },
          h("span", {}, "+ Add photos"),
          h("input", {
            type: "file",
            accept: "image/*",
            multiple: true,
            onchange: async (event) => {
              for (const file of event.target.files) {
                if (photos.length >= 12) break;
                try {
                  const data = await resizeImage(file);
                  photos.push({ upload: { data }, preview: `data:image/jpeg;base64,${data}` });
                } catch {
                  toast(`${file.name} couldn't be read. Try saving it as a JPEG first.`, { type: "error" });
                }
              }
              markDirty();
              drawPhotos();
            },
          }),
        ),
    );
  };
  drawPhotos();

  // Enquiry form: the default, or this guitar's own questions.
  let ownForm = guitar.form ? formBuilder(guitar.form) : null;
  const formBox = h("div");
  const drawForm = () => {
    const choice = (value, label) =>
      h("label", { class: "choice" },
        h("input", {
          type: "radio",
          name: "form-choice",
          checked: (value === "own") === !!ownForm,
          onchange: () => {
            ownForm = value === "own" ? formBuilder(state.content.home.enquiry_form) : null;
            markDirty();
            drawForm();
          },
        }),
        label,
      );
    formBox.replaceChildren(
      h("div", { class: "choices" }, choice("default", "Use the default questions"), choice("own", "Ask its own questions")),
      ownForm && ownForm.element,
    );
  };
  drawForm();

  const remove = !isNew && h("button", {
    type: "button",
    class: "button button-danger",
    onclick: async () => {
      if (!confirm(`Remove ${guitar.title} from the site?`)) return;
      try {
        await api("DELETE", `/api/guitars/${guitar.slug}`, { sha: guitar.sha });
        state.dirty = false;
        state.selected = "intro";
        await loadContent();
        savedToast(`${guitar.title} removed`);
      } catch (error) {
        showError(error);
      }
    },
  }, "Remove guitar");

  const { bar, run } = saveBar(async () => {
    const payload = {
      title: inputs.title.value,
      price: inputs.price.value,
      price_note: inputs.price_note.value,
      body: inputs.body.value,
      images: photos.map((p) => (p.upload ? { upload: p.upload } : { path: p.path })),
      form: ownForm ? ownForm.value() : null,
      order: guitar.order,
      sha: guitar.sha,
    };
    const { slug } = isNew
      ? await api("POST", "/api/guitars", payload)
      : await api("PUT", `/api/guitars/${guitar.slug}`, payload);
    state.selected = slug;
    await loadContent();
    savedToast();
  }, remove);

  return h(
    "form",
    { class: "editor", onsubmit: (e) => { e.preventDefault(); run(); } },
    h("h1", {}, isNew ? "New guitar" : guitar.title),
    field("Name", inputs.title, isNew ? "Shown as the heading and in the menu." : null),
    h("div", { class: "row" },
      field("Price", inputs.price, "Leave empty to show “Price on request”."),
      field("Price note", inputs.price_note),
    ),
    field("Description", inputs.body, "Leave a blank line between paragraphs."),
    h("fieldset", {}, h("legend", {}, "Photos"), photosBox, h("small", { class: "help" }, "Shown as thumbnails under the description, in this order. Photos are resized automatically.")),
    h("fieldset", {}, h("legend", {}, "Enquiry form"), formBox),
    bar,
  );
}

// Shrink photos before upload (max 2000px on the long side), returned as base64 JPEG.
async function resizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}
