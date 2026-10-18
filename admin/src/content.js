// Reads and writes the site's content files:
//   _data/home.yml     intro, default enquiry form, fine print, contact links
//   _guitars/*.md      one file per guitar (front matter + description, optional own form)

import YAML from "yaml";

const HOME_PATH = "_data/home.yml";
const GUITARS_DIR = "_guitars";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const FIELD_TYPES = ["text", "textarea", "select", "radio", "checkboxes"];
const CHOICE_TYPES = ["select", "radio", "checkboxes"];

export async function readContent(gh) {
  const [homeFile, guitarFiles] = await Promise.all([gh.read(HOME_PATH), gh.list(GUITARS_DIR)]);

  const guitars = await Promise.all(
    guitarFiles
      .filter((file) => file.name.endsWith(".md"))
      .map(async (file) => {
        const { text, sha } = await gh.read(file.path);
        return { slug: file.name.replace(/\.md$/, ""), sha, ...parseGuitar(text) };
      }),
  );
  guitars.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return { home: YAML.parse(homeFile.text), homeSha: homeFile.sha, guitars };
}

export async function saveHome(gh, input, user) {
  const current = await gh.read(HOME_PATH);
  assertUnchanged(current, input.sha, "the intro and fine print");

  // Edit the existing document so comments in the file survive.
  const doc = YAML.parseDocument(current.text);
  const home = input.home || {};
  const text = (value, max = 4000) => clean(value, max);
  const links = (list, fields) =>
    (Array.isArray(list) ? list : []).slice(0, 20).map((item) => {
      const out = {};
      for (const [field, max] of fields) out[field] = text(item?.[field], max);
      return out;
    });

  doc.delete("intro_title"); // the intro no longer has a heading
  doc.set("intro", text(home.intro));
  const photos = collectImages(home.intro_images, "intro");
  doc.set("intro_images", photos.images);
  doc.set("reach_out_label", text(home.reach_out_label, 60));
  doc.delete("reach_out_link"); // Reach out now opens the contact form
  doc.set("enquire_label", text(home.enquire_label, 60));
  doc.set("enquiry_form", normalizeForm(home.enquiry_form));
  doc.set("fine_print_title", required(text(home.fine_print_title, 60), "Fine print title"));
  doc.set("fine_print", links(home.fine_print, [["label", 80], ["body", 4000]]));
  doc.set(
    "contact",
    links(home.contact, [["label", 80], ["link", 300]]).map((item) => ({ ...item, link: safeLink(item.link) })),
  );

  await gh.commit({
    message: `Update intro and fine print (admin: ${user})`,
    author: author(user),
    files: [...photos.files, { path: HOME_PATH, text: doc.toString({ lineWidth: 0 }) }],
  });
}

export async function saveGuitar(gh, slug, input, user, { create = false } = {}) {
  const title = required(clean(input.title, 60), "Name");
  if (create) slug = slugify(title);
  if (!/^[a-z0-9-]+$/.test(slug)) throw badRequest("That name can't be used for a web address.");

  const path = `${GUITARS_DIR}/${slug}.md`;
  const current = await gh.read(path);
  if (create && current) throw badRequest(`There is already a guitar called ${title}.`);
  if (!create) {
    if (!current) throw notFound();
    assertUnchanged(current, input.sha, title);
  }

  let order = Number(input.order);
  if (create || !Number.isFinite(order)) {
    const existing = await readContent(gh);
    order = Math.max(0, ...existing.guitars.map((g) => g.order || 0)) + 1;
  }

  const { files, images } = collectImages(input.images, slug);

  const frontMatter = {
    title,
    order,
    price: clean(input.price, 40),
    price_note: clean(input.price_note, 200),
    images,
  };
  // Deposit (USD) buyers can pay online; empty means no deposit button.
  const deposit = parseDeposit(input.deposit);
  if (deposit) frontMatter.deposit = deposit;
  // No form means the guitar uses the default enquiry form.
  if (input.form) frontMatter.form = normalizeForm(input.form);
  const body = clean(input.body, 20000);
  files.push({ path, text: `---\n${YAML.stringify(frontMatter, { lineWidth: 0 })}---\n\n${body}\n` });

  await gh.commit({
    message: `${create ? "Add" : "Update"} ${title} (admin: ${user})`,
    author: author(user),
    files,
  });
  return slug;
}

export async function deleteGuitar(gh, slug, input, user) {
  const path = `${GUITARS_DIR}/${slug}.md`;
  const current = await gh.read(path);
  if (!current) throw notFound();
  assertUnchanged(current, input.sha, slug);
  // Photos stay in the repo so they can be reused or restored.
  await gh.commit({ message: `Remove ${slug} (admin: ${user})`, author: author(user), files: [{ path, delete: true }] });
}

export async function saveOrder(gh, input, user) {
  const files = [];
  for (const [index, item] of (input.order || []).entries()) {
    const path = `${GUITARS_DIR}/${item.slug}.md`;
    const current = await gh.read(path);
    if (!current) throw notFound();
    assertUnchanged(current, item.sha, item.slug);
    const guitar = parseGuitar(current.text);
    if (guitar.order === index + 1) continue;
    const { body, ...frontMatter } = { ...guitar, order: index + 1 };
    files.push({ path, text: `---\n${YAML.stringify(frontMatter, { lineWidth: 0 })}---\n\n${body}\n` });
  }
  if (files.length) await gh.commit({ message: `Reorder guitars (admin: ${user})`, author: author(user), files });
}

/**
 * Photos from the admin, in order: existing ones ({ path } or a plain path) are kept,
 * new uploads ({ upload: { data } }) become files under assets/images/<folder>/.
 */
function collectImages(list, folder) {
  const files = [];
  const images = [];
  const stamp = Date.now();
  for (const [index, image] of (Array.isArray(list) ? list : []).slice(0, 12).entries()) {
    if (image?.upload) {
      const base64 = String(image.upload.data || "");
      if (base64.length * 0.75 > MAX_IMAGE_BYTES) throw badRequest("One of the photos is too large.");
      const repoPath = `assets/images/${folder}/${stamp}-${index + 1}.jpg`;
      files.push({ path: repoPath, base64 });
      images.push(`/${repoPath}`);
    } else {
      const path = typeof image === "string" ? image : image?.path;
      if (isImagePath(path)) images.push(path);
    }
  }
  return { files, images };
}

/** "1500", "1.500", "1,500.00" -> "1500" (whole dollars); empty -> "". */
function parseDeposit(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const whole = text.replace(/[.,]\d{1,2}$/, "").replace(/[^\d]/g, "");
  const amount = Number(whole);
  if (!whole || !Number.isInteger(amount) || amount < 1 || amount > 100000) {
    throw badRequest("Enter the deposit as a whole number of dollars, e.g. 1500, or leave it empty.");
  }
  return String(amount);
}

export function isImagePath(path) {
  return typeof path === "string" && /^\/assets\/images\/[\w./-]+\.(jpe?g|png|webp|gif)$/i.test(path) && !path.includes("..");
}

/** The enquiry form for a guitar (its own, or the default), or for "general" (Reach out). */
export async function readForm(gh, slug) {
  if (slug === "general") {
    const home = await gh.read(HOME_PATH);
    return { guitar: { title: "General enquiry", price: "" }, form: YAML.parse(home.text).enquiry_form };
  }
  const [home, guitar] = await Promise.all([gh.read(HOME_PATH), gh.read(`${GUITARS_DIR}/${slug}.md`)]);
  if (!guitar) return null;
  const parsed = parseGuitar(guitar.text);
  return { guitar: parsed, form: parsed.form || YAML.parse(home.text).enquiry_form };
}

/**
 * Clean up a form definition from the admin:
 * { intro, submit_label, thanks, fields: [{ label, type, required?, help?, options? }] }
 * Name and email are always asked first and aren't part of `fields`.
 */
export function normalizeForm(form) {
  const input = form || {};
  const seen = new Set();
  const fields = (Array.isArray(input.fields) ? input.fields : []).slice(0, 20).map((field) => {
    const label = clean(field?.label, 120);
    if (!label) throw badRequest("Every question needs a label.");
    if (seen.has(label.toLowerCase())) throw badRequest(`There are two questions called "${label}".`);
    seen.add(label.toLowerCase());

    const type = FIELD_TYPES.includes(field?.type) ? field.type : "text";
    const out = { label, type };
    if (field?.required) out.required = true;
    const help = clean(field?.help, 200);
    if (help) out.help = help;
    if (CHOICE_TYPES.includes(type)) {
      const raw = Array.isArray(field.options) ? field.options : String(field.options || "").split("\n");
      const options = [...new Set(raw.map((option) => clean(option, 120)).filter(Boolean))].slice(0, 20);
      if (!options.length) throw badRequest(`"${label}" needs at least one option.`);
      out.options = options;
    }
    return out;
  });

  return {
    intro: clean(input.intro, 1000),
    fields,
    submit_label: clean(input.submit_label, 60) || "Send enquiry",
    thanks: clean(input.thanks, 500) || "Thank you. I'll be in touch soon.",
  };
}

export function parseGuitar(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = match ? YAML.parse(match[1]) || {} : {};
  return {
    title: data.title || "",
    order: data.order,
    price: data.price ?? "",
    price_note: data.price_note ?? "",
    ...(data.deposit && { deposit: String(data.deposit) }),
    images: Array.isArray(data.images) ? data.images : [],
    ...(data.form && { form: data.form }),
    body: (match ? match[2] : text).trim(),
  };
}

function assertUnchanged(current, expectedSha, what) {
  if (current && current.sha !== expectedSha) {
    throw Object.assign(new Error(`Someone else changed ${what} while you were editing. Reload to see their version.`), {
      status: 409,
    });
  }
}

function clean(value, max = 4000) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function required(value, label) {
  if (!value) throw badRequest(`${label} can't be empty.`);
  return value;
}

function safeLink(value) {
  const link = clean(value, 300);
  if (link && !/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(link)) throw badRequest(`"${link}" isn't a valid link.`);
  return link;
}

function slugify(title) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function author(user) {
  return { name: user, email: "admin@moarguitars.com" };
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function notFound() {
  return Object.assign(new Error("That guitar no longer exists. Reload the page."), { status: 404 });
}
