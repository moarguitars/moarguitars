# Moar admin

The admin at **admin.moarguitars.com** lets collaborators sign in with a username and password and:

- edit the intro, guitars (text, price, photos, order) and fine print;
- edit the **enquiry form**: a default set of questions, and optionally different questions for any guitar;
- work through the **Enquiries inbox**: read enquiries, keep private notes, archive them;
- **request payments**: send the customer a PayPal invoice for any amount and see when it's paid.

Content edits are commits to `moarguitars/moarguitars`, so GitHub Pages republishes the site about a minute later and every change is in the git history. Enquiries and payments are stored in a Cloudflare D1 database.

It runs on Cloudflare Workers' free plan; the site itself stays on GitHub Pages.

## How it fits together

```
moarguitars.com (GitHub Pages)
   └─ Enquire form ── POST /api/enquiries ──┐
                                            ▼
admin.moarguitars.com (Cloudflare Worker)
   ├─ public/            the admin UI
   ├─ src/worker.js      routes; everything except the two public endpoints needs sign-in
   ├─ src/auth.js        username/password (PBKDF2 hashes), signed session cookies
   ├─ src/content.js     reads/writes _data/home.yml and _guitars/*.md via GitHub
   ├─ src/enquiries.js   stores enquiries (D1), inbox, payment requests
   ├─ src/paypal.js      PayPal invoices + webhook verification
   └─ src/notify.js      email alerts, server-side Google Analytics events
            │                         │
            ▼                         ▼
   GitHub (commits)          PayPal ── webhook ──> POST /api/paypal/webhook ──> marks "Paid"
```

**How an enquiry flows through:**
1. A visitor fills in the form under a guitar.
2. The Worker checks the answers against that guitar's actual questions, runs a spam check (Turnstile, a hidden trap field, and a limit of 5 per hour per visitor), stores the enquiry and emails atelier@.
3. In the inbox you click **Send PayPal invoice**. PayPal emails the customer, who can pay by card or PayPal.
4. When it's paid, PayPal notifies the Worker. The inbox shows **Paid**, you get an email, and Google Analytics records a `purchase` against the guitar and the original visitor.

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

### 3. PayPal
1. Sign in to [developer.paypal.com](https://developer.paypal.com) with the Moar PayPal business account. Under Apps & Credentials, switch to **Live** and create an app (e.g. "Moar admin"). Copy its Client ID and Secret.
2. In that app, add a webhook with the URL `https://admin.moarguitars.com/api/paypal/webhook` (or the `workers.dev` address until the domain is set up). Subscribe to **Invoicing invoice paid** and **Invoicing invoice cancelled**, then copy the webhook ID.

To test with fake money first, do the same under **Sandbox**, and set `PAYPAL_API = "https://api-m.sandbox.paypal.com"` in `wrangler.toml`.

### 4. Secrets
They're stored encrypted at Cloudflare, never in the repo.
```bash
npx wrangler secret put GITHUB_TOKEN
npm run --silent users | npx wrangler secret put USERS
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler secret put PAYPAL_WEBHOOK_ID
```
`npm run users` asks for each person's username and password (at least 10 characters). To add, remove or reset someone, run that line again with everyone's details; it replaces the whole list.

### 5. Deploy
```bash
npm run deploy
```
It works straight away at the `*.workers.dev` address Wrangler prints. Until step 6 is done, put that address in the site's `_config.yml` (`enquiry_endpoint: "https://moar-admin.<you>.workers.dev/api/enquiries"`) and in `ADMIN_URL`.

### 6. admin.moarguitars.com, email alerts and spam protection
These need moarguitars.com's DNS on Cloudflare (it's at GoDaddy now):
1. In Cloudflare, choose **Add a domain** → `moarguitars.com` (Free plan). It copies the existing DNS records. Check that the GitHub Pages records are there (four `A` records for `moarguitars.com` and a `CNAME` for `www` to `moarguitars.github.io`) and set them to **DNS only** (grey cloud).
2. At GoDaddy, change the nameservers to the two Cloudflare gives you. This is usually done within an hour, and the site keeps working throughout.
3. Uncomment the `routes` line in `wrangler.toml`.
4. **Email alerts:** in Cloudflare, go to Email → Email Routing, enable it and add `atelier@moarguitars.com` as a verified destination. Then uncomment the `[[send_email]]` block in `wrangler.toml`.

   Note: if atelier@ mail is hosted somewhere (Google Workspace, GoDaddy email…), keep its existing `MX` records. Email Routing would replace them, so in that case skip the alerts, or use a different address you control as `NOTIFY_TO`.
5. **Spam check:** in Cloudflare, go to Turnstile → Add widget for `moarguitars.com`. Put the site key in the site's `_config.yml` (`turnstile_site_key`) and run `npx wrangler secret put TURNSTILE_SECRET` with the secret key.
6. Run `npm run deploy` again.

### 7. Optional: payments in Google Analytics
In GA, go to Admin → Data streams → your stream → **Measurement Protocol API secrets** → Create. Then run:
```bash
npx wrangler secret put GA_API_SECRET
```
Payment requests then show up as `begin_checkout` events and payments as `purchase` events, tied to the visitor who enquired (if they accepted analytics cookies).

## Working on it locally

Nothing touches GitHub or PayPal locally. Fake versions of both run on your machine:
- `dev/mock-github.mjs` writes saves straight into this checkout, so `jekyll serve` shows them instantly.
- `dev/mock-paypal.mjs` gives each invoice a pretend payment page with a **Pay** button, which sends the same webhook PayPal would.

```bash
# from the repo root: the site, pointed at the local admin
jekyll serve --livereload --config _config.yml,_config.dev.yml
# in admin/: one-time local database setup, then three servers
npm run db:local
npm run mock-github
npm run mock-paypal
npm run dev                # http://localhost:8787
```

`.dev.vars` (git-ignored) holds the local secrets and a test login (username `demo`, password in the file's comment). Alert emails are printed in the `npm run dev` output instead of being sent. Note that local content saves really do change the files in your checkout.
