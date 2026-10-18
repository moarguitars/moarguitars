// Open guitar thumbnails in a simple lightbox.
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");

document.querySelectorAll("[data-lightbox]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    lightboxImage.src = link.href;
    lightboxImage.alt = link.querySelector("img").alt;
    lightbox.showModal();
  });
});

// Click outside the photo to close.
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

// ---------- Guitars: teaser until opened ----------

// Opening a guitar ("Description and pricing") shows its description, price and Enquire.
// Analytics listens for "moar:guitar-open" (see analytics.js).
function openGuitar(section, how) {
  if (!section || section.classList.contains("is-open")) return;
  section.classList.add("is-open");
  section.querySelector("[data-read-more]")?.setAttribute("aria-expanded", "true");
  section.dispatchEvent(new CustomEvent("moar:guitar-open", { bubbles: true, detail: { how } }));
}

document.querySelectorAll("[data-read-more]").forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.closest(".guitar");
    openGuitar(section, "read_more");
    section.querySelector(".guitar-more .prose p, .guitar-more .price")?.setAttribute("tabindex", "-1");
    section.querySelector(".guitar-more .prose p, .guitar-more .price")?.focus({ preventScroll: true });
  });
});

// The index at the top opens the guitar it jumps to (counted as "index" in analytics).
document.querySelectorAll(".index a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    const target = document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
    if (target?.classList.contains("guitar")) openGuitar(target, "index");
  });
});

// A link straight to a guitar (e.g. moarguitars.com/#ella shared on Instagram) opens it.
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (target && target.classList.contains("guitar")) openGuitar(target, "link");
}
window.addEventListener("hashchange", openFromHash);
openFromHash();

// ---------- Enquiry forms ----------

const ENQUIRY_ENDPOINT = document.currentScript.dataset.enquiryEndpoint;

// "Enquire" shows and hides the guitar's form.
document.querySelectorAll("[data-enquire]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const panel = document.getElementById(link.getAttribute("aria-controls"));
    const open = panel.hidden;
    panel.hidden = !open;
    link.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("input, textarea, select")?.focus({ preventScroll: true });
  });
});

document.querySelectorAll("[data-enquiry-form]").forEach((form) => {
  const errorBox = form.querySelector(".form-error");
  const button = form.querySelector(".send");
  const buttonLabel = button.textContent;

  const showError = (message, focus) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
    focus?.focus();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    if (!name) return showError("Please add your name.", form.elements.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Please add a valid email address.", form.elements.email);

    // Answers keyed by question, in the order asked.
    const answers = [];
    for (const question of form.querySelectorAll("[data-question]")) {
      const label = question.dataset.question;
      let value;
      if (question.dataset.type === "checkboxes") {
        value = [...question.querySelectorAll("input:checked")].map((input) => input.value);
      } else if (question.dataset.type === "radio") {
        value = question.querySelector("input:checked")?.value || "";
      } else {
        value = question.querySelector("input, textarea, select").value.trim();
      }
      const empty = Array.isArray(value) ? value.length === 0 : value === "";
      if (empty && question.hasAttribute("data-required")) {
        return showError(`Please answer “${label}”.`, question.querySelector("input, textarea, select"));
      }
      answers.push({ question: label, answer: value });
    }

    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const response = await fetch(ENQUIRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guitar: form.dataset.guitar,
          name,
          email,
          answers,
          website: form.elements.website.value,
          turnstile: form.querySelector("[name='cf-turnstile-response']")?.value || "",
          analytics_client_id: window.moarAnalyticsClientId || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Sorry, that didn't send. Please try again or email atelier@moarguitars.com.");

      const thanks = form.parentElement.querySelector(".enquiry-thanks");
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
      form.dispatchEvent(new CustomEvent("moar:enquiry-sent", { bubbles: true }));
    } catch (error) {
      const message = error instanceof TypeError
        ? "Sorry, that didn't send. Please check your connection and try again."
        : error.message;
      showError(message);
      window.turnstile?.reset(form.querySelector(".cf-turnstile"));
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  });
});
