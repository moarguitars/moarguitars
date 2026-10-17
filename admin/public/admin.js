// Moar admin: edit the intro, guitars and fine print. Each save is a commit to GitHub,
// and GitHub Pages republishes the site about a minute later.

const app = document.getElementById("app");
const userBox = document.querySelector(".bar-user");

const state = {
  user: null,
  siteUrl: "",
  content: null,
  selected: "intro", // "intro" | "fine-print" | "new" | a guitar slug
  dirty: false,
  order: null, // pending guitar order (array of slugs) before it's saved
};

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
  if (!["intro", "fine-print", "new", ...slugs].includes(state.selected)) state.selected = "intro";
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
    h("button", { class: "button button-quiet button-small", onclick: logout }, "Sign out"),
  );
  app.replaceChildren(h("div", { class: "layout" }, renderNav(), renderEditor()));
}

function select(key) {
  if (key === state.selected) return;
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
    reach_out_link: textInput(home.reach_out_link, { maxlength: 300 }),
    enquire_label: textInput(home.enquire_label, { maxlength: 60 }),
    enquiry_email: textInput(home.enquiry_email, { maxlength: 200, type: "email" }),
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
    h("div", { class: "row" },
      field("Button text", inputs.reach_out_label),
      field("Button link", inputs.reach_out_link, "An email (mailto:you@example.com) or a web address."),
    ),
    h("fieldset", {},
      h("legend", {}, "Enquire link"),
      h("p", { class: "help" }, "Shown under every guitar. It opens an email with the guitar’s name in the subject."),
      h("div", { class: "row" },
        field("Link text", inputs.enquire_label),
        field("Send enquiries to", inputs.enquiry_email, "Leave empty to hide the link."),
      ),
    ),
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
