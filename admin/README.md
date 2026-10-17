# Moar admin

The editor at **admin.moarguitars.com**. Collaborators sign in with a username and password and edit the intro, guitars (text, price, photos, order) and fine print.

Every save is a commit to `moarguitars/moarguitars` on GitHub, so GitHub Pages republishes the site about a minute later and every change is in the git history (and can be undone).

It runs on Cloudflare Workers' free plan. The site itself stays on GitHub Pages.

## How it fits together

```
browser ──> admin.moarguitars.com (Cloudflare Worker)
              ├─ public/        the editor UI
              └─ src/worker.js  /api/*: sign-in, read content, save
                    └─> GitHub API ──> commit to master ──> GitHub Pages rebuilds moarguitars.com
```

- `src/auth.js`: passwords are stored only as PBKDF2 hashes in the `USERS` secret. Sessions are signed, HttpOnly cookies that last 14 days.
- `src/content.js`: reads and writes `_data/home.yml` and `_guitars/*.md`. If someone else saved the same thing since you opened it, the save is refused rather than overwriting their work.
- `src/github.js`: commits all the files in one save (text plus any new photos) as a single commit.

Photos are shrunk in the browser to at most 2000px before upload. iPhone HEIC photos only work from Safari; in other browsers, export them as JPEG first.

## Going live (one-time setup)

You need Node 20 (`nvm use` in this folder) and a free Cloudflare account.

1. **GitHub token.** On GitHub, go to Settings → Developer settings → Fine-grained tokens → Generate new token:
   - Resource owner: `moarguitars`
   - Repository access: only `moarguitars/moarguitars`
   - Permissions: **Contents: Read and write** (nothing else)

   If the token expires, saves stop working until you replace it (step 3).

2. **Install and log in to Cloudflare**
   ```bash
   cd admin
   npm install
   npx wrangler login
   ```

3. **Set the secrets** (they're stored encrypted at Cloudflare, never in the repo)
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   npm run --silent users | npx wrangler secret put USERS
   openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
   ```
   `npm run users` asks for each person's username and password (at least 10 characters). To add, remove or reset someone later, run that line again with everyone's details; it replaces the whole list.

4. **Deploy**
   ```bash
   npm run deploy
   ```
   It works straight away at the `*.workers.dev` address Wrangler prints.

5. **Use admin.moarguitars.com.** Cloudflare can only attach a Worker to a domain whose DNS it manages, and moarguitars.com's DNS is currently at GoDaddy:
   1. In Cloudflare, choose Add a domain → `moarguitars.com` (Free plan). It copies your existing DNS records. Check that the GitHub Pages records are all there (four `A` records for `moarguitars.com` and a `CNAME` for `www` to `moarguitars.github.io`), and set them to **DNS only** (grey cloud).
   2. At GoDaddy, change the nameservers to the two Cloudflare gives you. This usually takes under an hour; the site keeps working throughout.
   3. Uncomment the `routes` line in `wrangler.toml` and run `npm run deploy` again.

## Working on it locally

Nothing touches GitHub locally. A fake GitHub (`dev/mock-github.mjs`) writes saves straight into this checkout, so `jekyll serve` shows them instantly.

```bash
# terminal 1: the site, from the repo root
jekyll serve --livereload
# terminal 2: fake GitHub
cd admin && npm run mock-github
# terminal 3: the admin, at http://localhost:8787
cd admin && npm run dev
```

`.dev.vars` (git-ignored) holds the local secrets and a test login (username `demo`, password in the file's comment). Note that local saves really do change the files in your checkout.
