// Google Analytics 4, loaded only after the visitor accepts the consent banner.
//
// Guitar interactions are sent as GA4 ecommerce events (each guitar is an "item"),
// so GA's item reports show a funnel per guitar:
//   select_item        clicked the guitar in the index
//   view_item          opened the guitar ("Description and pricing" or a link to it), which shows its price
//   view_photo         opened one of its photos
//   guitar_engagement  seconds spent on it while open (sent when the tab is hidden or closed)
//   view_fine_print    read a fine print topic (e.g. Commission & Payment)
//   enquiry_open       opened the guitar's enquiry form
//   generate_lead      sent the enquiry form (value = guitar price), or clicked a contact link
// Payment requests and payments are sent later from the admin server (begin_checkout,
// purchase), tied to the same visitor via the client ID passed with the enquiry.
//
// On the live site, add ?ga_debug to the URL to see events in GA's DebugView.
// Anywhere else (a local preview), events are only logged to the browser console.

const GA_ID = document.currentScript.dataset.gaId;
const CONSENT_KEY = "moar-analytics-consent";
const banner = document.querySelector(".consent");

function storedConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function storeConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode etc.: ask again next visit.
  }
}

const consent = storedConsent();
if (consent === "granted") startAnalytics();
else if (consent !== "denied") banner.hidden = false;

banner.addEventListener("click", (event) => {
  const button = event.target.closest("[data-consent]");
  if (!button) return;
  storeConsent(button.dataset.consent);
  banner.hidden = true;
  if (button.dataset.consent === "granted") startAnalytics();
});

// "Cookie settings" in the fine print lets visitors change their mind.
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-consent-reset]")) return;
  const wasGranted = storedConsent() === "granted";
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {}
  if (wasGranted) location.reload(); // unload GA
  else banner.hidden = false;
});

function startAnalytics() {
  window.dataLayer = window.dataLayer || [];

  // Off the live site (e.g. a local preview), log events to the console instead of
  // sending them to Google, so testing doesn't pollute the real numbers.
  const isLive = /(^|\.)moarguitars\.com$/.test(location.hostname);
  if (!isLive && !location.search.includes("ga_debug")) {
    window.gtag = function gtag(command, name, params) {
      window.dataLayer.push(arguments);
      if (command === "event") console.info(`[analytics] ${name}`, params);
    };
    trackGuitars();
    return;
  }

  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  gtag("config", GA_ID, location.search.includes("ga_debug") ? { debug_mode: true } : {});
  // Sent with enquiries so later payments can be tied back to this visitor.
  gtag("get", GA_ID, "client_id", (id) => {
    window.moarAnalyticsClientId = id;
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.append(script);

  trackGuitars();
}

function trackGuitars() {
  // "$ 8.500" or "$8,500" -> 8500. Empty ("Price on request") -> undefined.
  const parsePrice = (text) => {
    const digits = String(text || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : undefined;
  };

  const guitars = [...document.querySelectorAll("[data-guitar]")].map((section) => {
    const price = parsePrice(section.dataset.price);
    return {
      section,
      item: { item_id: section.dataset.guitar, item_name: section.dataset.guitarName, ...(price && { price }) },
      viewed: false,
      inFocus: false,
      focusStart: null,
      seconds: 0,
    };
  });

  const guitarFor = (element) => guitars.find((g) => g.section.contains(element));
  const value = (g) => (g.item.price ? { currency: "USD", value: g.item.price } : {});
  let lastGuitar = null; // the guitar most recently in view, for context on general contact clicks

  gtag("event", "view_item_list", { item_list_name: "Guitars", items: guitars.map((g) => g.item) });

  const isOpen = (g) => g.section.classList.contains("is-open");

  // Opened: a deliberate "Description and pricing" click (or a link to the guitar), which reveals the price.
  document.addEventListener("moar:guitar-open", (event) => {
    const g = guitarFor(event.target);
    if (!g || g.viewed) return;
    g.viewed = true;
    lastGuitar = g;
    if (g.inFocus) g.focusStart ??= performance.now();
    gtag("event", "view_item", { ...value(g), guitar: g.item.item_name, open_method: event.detail?.how || "read_more", items: [g.item] });
  });
  // A guitar opened before analytics started (e.g. arriving on moarguitars.com/#ella).
  for (const g of guitars) {
    if (isOpen(g) && !g.viewed) {
      g.viewed = true;
      gtag("event", "view_item", { ...value(g), guitar: g.item.item_name, open_method: "link", items: [g.item] });
    }
  }

  // Time spent: an open guitar's section crosses the middle of the screen.
  const focusObserver = new IntersectionObserver(
    (entries) => {
      const now = performance.now();
      for (const entry of entries) {
        const g = guitarFor(entry.target);
        g.inFocus = entry.isIntersecting;
        if (g.inFocus) {
          if (isOpen(g)) g.focusStart ??= now;
          lastGuitar = g;
        } else if (g.focusStart !== null) {
          g.seconds += (now - g.focusStart) / 1000;
          g.focusStart = null;
        }
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );

  for (const g of guitars) focusObserver.observe(g.section);

  // Send time spent whenever the page is hidden (tab switch, app switch, close).
  document.addEventListener("visibilitychange", () => {
    const now = performance.now();
    if (document.visibilityState === "hidden") {
      for (const g of guitars) {
        if (g.focusStart !== null) g.seconds += (now - g.focusStart) / 1000;
        g.focusStart = null;
        if (g.seconds >= 3) {
          gtag("event", "guitar_engagement", {
            guitar: g.item.item_name,
            engagement_seconds: Math.round(g.seconds),
            items: [g.item],
          });
        }
        g.seconds = 0;
      }
    } else {
      for (const g of guitars) if (g.inFocus && isOpen(g)) g.focusStart = now;
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    if (link.matches("[data-enquire]")) {
      if (link.getAttribute("aria-expanded") !== "true") return; // only count opening
      const g = guitarFor(link);
      gtag("event", "enquiry_open", g ? { guitar: g.item.item_name, items: [g.item] } : { form: "contact", ...(lastGuitar && { guitar: lastGuitar.item.item_name }) });
      return;
    }

    if (link.matches("[data-lightbox]")) {
      const g = guitarFor(link);
      if (!g) return gtag("event", "view_photo", { area: "intro" }); // workshop photos in the intro
      const photos = [...g.section.querySelectorAll("[data-lightbox]")];
      gtag("event", "view_photo", { guitar: g.item.item_name, photo_number: photos.indexOf(link) + 1, items: [g.item] });
      return;
    }

    if (link.closest(".index")) {
      const g = guitars.find((x) => `#${x.section.id}` === link.getAttribute("href"));
      if (g) gtag("event", "select_item", { item_list_name: "Guitars", guitar: g.item.item_name, items: [g.item] });
      return;
    }

    if (link.matches("[data-contact]")) {
      gtag("event", "generate_lead", {
        method: link.dataset.contact,
        ...(lastGuitar && { guitar: lastGuitar.item.item_name }),
      });
    }
  });

  document.addEventListener("moar:enquiry-sent", (event) => {
    const g = guitarFor(event.target);
    if (g) gtag("event", "generate_lead", { ...value(g), method: "enquiry_form", guitar: g.item.item_name, items: [g.item] });
    else gtag("event", "generate_lead", { method: "contact_form", ...(lastGuitar && { guitar: lastGuitar.item.item_name }) });
  });

  // Fine print topics (toggle doesn't bubble, so listen while capturing).
  document.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (!details.matches?.("[data-fine-print]") || !details.open) return;
      gtag("event", "view_fine_print", {
        topic: details.dataset.finePrint,
        ...(lastGuitar && { guitar: lastGuitar.item.item_name }),
      });
    },
    true,
  );
}
