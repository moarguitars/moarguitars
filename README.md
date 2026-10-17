# moarguitars.com

A single-page Jekyll site served by GitHub Pages from `master`. Collaborators edit it through the admin at admin.moarguitars.com (see [admin/README.md](admin/README.md)).

| What | Where |
| --- | --- |
| Page template | `index.html` |
| Styles / scripts | `assets/css/site.css`, `assets/js/` |
| Intro, Enquire link, fine print, contact links | `_data/home.yml` |
| One file per guitar (name, price, photos, text) | `_guitars/*.md` |
| Photos | `assets/images/<guitar>/` |
| Google Analytics ID | `_config.yml` → `google_analytics_id` |

Run locally with `jekyll serve --livereload` and open http://localhost:4000.

## How visitors get in touch

- **Enquire** under each guitar: opens an email to `enquiry_email` with the subject "Enquiry: <guitar>". This is the main conversion.
- **Reach out** under the intro, plus the Email / Instagram / Facebook / WhatsApp links in the Fine Print.

## Google Analytics

Analytics is off until you set an ID. When it's on, visitors see a small consent banner, and nothing loads unless they accept. Visitors can change their choice later from "Cookie settings" in the Fine Print. This is required for EU visitors.

### Setup

1. In [Google Analytics](https://analytics.google.com), create a GA4 property and a Web data stream for `https://moarguitars.com`. Copy the measurement ID (`G-…`).
2. Put it in `_config.yml`: `google_analytics_id: "G-…"` and push.
3. In GA, open Admin → Data display → **Custom definitions** and add these event-scoped custom dimensions/metrics, so they appear in reports:

   | Name | Scope | Event parameter |
   | --- | --- | --- |
   | Guitar | Event (dimension) | `guitar` |
   | Contact method | Event (dimension) | `method` |
   | Fine print topic | Event (dimension) | `topic` |
   | Photo number | Event (dimension) | `photo_number` |
   | Seconds on guitar | Event (metric, seconds) | `engagement_seconds` |

4. Admin → Data display → **Events**: mark `generate_lead` as a **key event**.
5. To check it's working, visit `https://moarguitars.com/?ga_debug`, accept the banner, and watch Admin → DebugView.

### What's tracked

Each guitar is a GA "item", so the built-in **Reports → Monetization → Ecommerce purchases** item table shows views and clicks per guitar.

| Event | When | Tells you |
| --- | --- | --- |
| `view_item_list` | Page load | Baseline: visits |
| `select_item` | Guitar clicked in the index | Interest before scrolling |
| `view_item` | Guitar's **price** was on screen for 1s+ | Who actually saw the price |
| `view_photo` | A photo opened (with photo number) | Interest in detail |
| `guitar_engagement` | Seconds spent on the guitar | Depth of interest |
| `view_fine_print` | A fine print topic opened, with the last guitar viewed | Payment intent (e.g. *Commission & Payment*, *Deposit rules*, *Bank transfer details*) |
| `generate_lead` | **Enquire** clicked (value = guitar price, USD), or a contact link | Conversion |

### Propensity to pay: the funnel report

In GA, go to **Explore → Funnel exploration** and set up these steps:

1. Saw the price: event `view_item`
2. Engaged: event `view_photo` **or** `guitar_engagement` with *Seconds on guitar* ≥ 20
3. Looked at payment terms: event `view_fine_print` where *Fine print topic* is Commission & Payment, Deposit rules or Bank transfer details
4. Enquired: event `generate_lead`

Break it down by **Guitar**. For each guitar this shows the share of people who saw the price and then went on to engage, check the payment terms and enquire. A guitar whose price is often seen but rarely followed by step 3 or 4 suggests price friction. A high step 3→4 rate suggests ready buyers.

Because `generate_lead` carries the guitar's price as its value, the **Key events** value total shows the dollar value of enquiries per guitar.
