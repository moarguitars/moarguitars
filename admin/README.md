# Moar admin

The admin at **https://moar-admin.moarguitars.workers.dev** lets collaborators sign in with a username and password and:

- edit the intro, guitars (text, price, photos, order) and fine print;
- edit the **enquiry form**: a default set of questions, and optionally different questions for any guitar;
- work through the **Enquiries inbox**: read enquiries, keep private notes, archive them;
- **request payments**: email the customer a Stripe invoice for any amount and see when it's paid.

Content edits are commits to `moarguitars/moarguitars`, so GitHub Pages republishes the site about a minute later and every change is in the git history. Enquiries and payments are stored in a Cloudflare D1 database.

It runs on Cloudflare Workers' free plan; the site itself stays on GitHub Pages.

## How it fits together

```
moarguitars.com (GitHub Pages)
   └─ Enquire form ── POST /api/enquiries ──┐
                                            ▼
moar-admin.moarguitars.workers.dev (Cloudflare Worker)
   ├─ public/            the admin UI
   ├─ src/worker.js      routes; everything except the two public endpoints needs sign-in
   ├─ src/auth.js        username/password (PBKDF2 hashes), signed session cookies
   ├─ src/content.js     reads/writes _data/home.yml and _guitars/*.md via GitHub
   ├─ src/enquiries.js   stores enquiries (D1), inbox, payment requests
   ├─ src/stripe.js      Stripe invoices + webhook signature checks
   └─ src/notify.js      email alerts (Formspree), server-side Google Analytics events
            │                         │
            ▼                         ▼
   GitHub (commits)          Stripe ── webhook ──> POST /api/stripe/webhook ──> marks "Paid"
```

**How an enquiry flows through:**
1. A visitor fills in the form under a guitar.
2. The Worker checks the answers against that guitar's actual questions, runs a spam check (Turnstile, a hidden trap field, and a limit of 5 per hour per visitor), stores the enquiry and emails atelier@.
3. In the inbox you click **Send invoice**. Stripe emails the customer, who pays on Stripe's hosted page (card, Apple Pay, Google Pay; due within 14 days).
4. When it's paid, Stripe notifies the Worker. The inbox shows **Paid**, you get an email, and Google Analytics records a `purchase` against the guitar and the original visitor.

## Going live (one-time setup)

You need Node 20 (`nvm use` in this folder) and a free Cloudflare account. Run the commands from `admin/`.

### 1. GitHub token
GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token:
- Resource owner: `moarguitars`
- Repository access: only `moarguitars/moarguitars`
- Permissions: **Contents: Read and write** (nothing else)

### 2. Cloudflare and the database
```bash
npm install
npx wrangler login
npx wrangler d1 create moar-admin
```
Paste the `database_id` it prints into `wrangler.toml`, then create the tables:
```bash
npm run db:remote
```

### 3. Stripe
In the [Stripe dashboard](https://dashboard.stripe.com) for the Moar account:
1. **API key:** Developers → API keys → **Create restricted key**, named "Moar admin". Set **Customers**, **Invoices** and **Invoice items** to **Write** and leave everything else at None. Copy the key (`rk_live_…`).
2. **Webhook:** Developers → Webhooks → **Add endpoint**:
   - URL: `https://moar-admin.moarguitars.workers.dev/api/stripe/webhook`
   - Events: `invoice.paid` and `invoice.voided`

   Then reveal and copy the **Signing secret** (`whsec_…`).
3. **Optional:** under Settings → Payment methods you can turn on MobilePay, and Settings → Invoices sets the invoice branding (logo, colours, footer).

To try it with fake money first, use **Test mode** keys and webhook (`rk_test_…`) and Stripe's test card `4242 4242 4242 4242`.

### 3b. Email alerts (Formspree)
New enquiries and payments are emailed to you by submitting them to the existing Formspree form `xgebpvey` (`FORMSPREE_FORM` in `wrangler.toml`). Formspree emails whoever that form is set up to deliver to; change that in the Formspree dashboard. Replying to an alert replies to the customer. Nothing needs adding to DNS, and the Google Workspace mail is untouched.

Formspree's free plan allows **50 submissions a month**. If it runs out, enquiries are still saved in the inbox; only the emails stop until the next month. If Formspree marks alerts as spam, open the form's settings in Formspree and turn off reCAPTCHA/spam filtering for it.

### 4. Secrets
They're stored encrypted at Cloudflare, never in the repo.
```bash
npx wrangler secret put GITHUB_TOKEN
npm run --silent users | npx wrangler secret put USERS
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```
`npm run users` asks for each person's username and password (at least 10 characters). It sets everyone's starting password and who is allowed in.

After that, people change their own password in the admin (**Change password** in the top bar), which signs them out on their other devices. To add or remove someone, or reset a forgotten password, run the `npm run users` line again with everyone's details; it replaces the whole list, and a reset password takes priority over one changed in the admin.

### 5. Deploy
```bash
npm run deploy
```
It's served at `https://moar-admin.moarguitars.workers.dev`. The site's `_config.yml` (`enquiry_endpoint`) and `ADMIN_URL` in `wrangler.toml` both point there.

The domain's DNS stays at GoDaddy, so the admin keeps its `workers.dev` address. (Moving moarguitars.com's DNS to Cloudflare would allow `admin.moarguitars.com` via the commented-out `routes` line in `wrangler.toml`, but it isn't needed.)

### 6. Optional: spam check (Cloudflare Turnstile)
Turnstile works with the domain's DNS anywhere, including GoDaddy.
1. In Cloudflare, go to **Turnstile** → **Add widget**: name it "Moar enquiry forms", add the hostname `moarguitars.com`, and leave the mode on **Managed**.
2. Put the **site key** in the site's `_config.yml` (`turnstile_site_key`) and push.
3. Run `npx wrangler secret put TURNSTILE_SECRET` with the **secret key**. The check applies straight away, with no redeploy needed.

Do steps 2 and 3 together. With only the secret set, every enquiry is rejected; with only the site key, the check is shown but not enforced.

### 7. Optional: payments in Google Analytics
In GA, go to Admin → Data streams → your stream → **Measurement Protocol API secrets** → Create. Then run:
```bash
npx wrangler secret put GA_API_SECRET
```
Payment requests then show up as `begin_checkout` events and payments as `purchase` events, tied to the visitor who enquired (if they accepted analytics cookies).

### 8. Optional: the Insights page (read access to Google Analytics)
The admin's **Insights** page shows each guitar's funnel: people who saw the price, opened photos, spent time, opened the form, enquired, were invoiced and paid. The inbox numbers work straight away. The Google Analytics columns need the admin to have read-only access to the GA property (`GA_PROPERTY_ID` in `wrangler.toml`), through a Google "service account":

1. Go to [console.cloud.google.com](https://console.cloud.google.com). In the project picker at the top, choose **New project**, name it "Moar website", and create it.
2. Search the top bar for **Google Analytics Data API**, open it, and click **Enable**.
3. Menu → **IAM & Admin** → **Service accounts** → **Create service account**. Name it `moar-admin-insights`, click **Create and continue**, skip the optional role and user steps, then **Done**.
4. Click the new service account → **Keys** → **Add key** → **Create new key** → **JSON**. A `.json` file downloads. Copy the service account's email address (it ends `.iam.gserviceaccount.com`).
5. In Google Analytics: **Admin** → **Property access management** → **+** → **Add users**. Paste that email, choose the **Viewer** role, untick "Notify new users", and click **Add**.
6. Save the key as a secret, then delete the downloaded file:
   ```bash
   npx wrangler secret put GA_SERVICE_ACCOUNT < ~/Downloads/<the-file>.json
   ```

If step 4 says key creation is disabled, the Google account belongs to a Google Workspace organisation that blocks keys. Either ask its admin to allow service account keys for this project, or make the Cloud project with a personal Google account; the service account only needs Viewer access in GA (step 5).

The page also needs the custom dimension **Guitar** (event parameter `guitar`) and the metric **Seconds on guitar** (`engagement_seconds`) from the main README. GA can take a day to show new data.

## Working on it locally

Nothing touches GitHub, Stripe or Formspree locally. Fake versions run on your machine:
- `dev/mock-github.mjs` writes saves straight into this checkout, so `jekyll serve` shows them instantly.
- `dev/mock-stripe.mjs` gives each invoice a pretend payment page with a **Pay** button, which sends a signed webhook just like Stripe's. It also prints the alerts that would go to Formspree.

```bash
# from the repo root: the site, pointed at the local admin
jekyll serve --livereload --config _config.yml,_config.dev.yml
# in admin/: one-time local database setup, then three servers
npm run db:local
npm run mock-github
npm run mock-stripe
npm run mock-google        # fake Google Analytics for the Insights page
npm run dev                # http://localhost:8787
```

`.dev.vars` (git-ignored) holds the local secrets and a test login (username `demo`, password in the file's comment). Alert emails are printed in the `npm run mock-stripe` output instead of being sent. Note that local content saves really do change the files in your checkout.
