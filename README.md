# Kodo verify gate (deploy repo kanatat3/solotask)

These files live at the root of the deploy repo. Netlify runs `npm run verify` as its build command (`netlify.toml`), so a failing check stops the deploy and the live site keeps the last good version. GitHub Actions (`.github/workflows/verify.yml`) runs the same check on every push.

`npm run verify` runs three steps:
1. **lint**: `scripts/check-page.mjs` makes sure every inline script parses, each page has lang/title/viewport, and no server-side Supabase key is present.
2. **build**: `scripts/build.mjs` copies the site files into `dist/`, which is the folder Netlify publishes. It also writes `dist/version.json` with the commit, the Node version and the build time, so `curl https://kodotodolist.netlify.app/version.json` shows which build is live.
3. **test:e2e**: Playwright drives `dist/` the way a user would.
   - Projects: mobile, desktop, and dark (mobile in dark mode).
   - Flows: home, the tap-first task form, the Work overview, project workflow and rounds, the Calendar/All/Settings tabs, request.html (invalid link, sending with a file, the name being remembered) and the privacy/terms pages.
   - axe checks WCAG 2.1 AA on every page and state; any violation fails the run.

## Deploying
1. Copy the newest `Kodo Vx.y (...).html` to `index.html` in the deploy clone. If `request.html`, `privacy.html`, `terms.html`, `sw.js` or `_headers` changed, copy those too, along with any changed files from this folder.
2. Run `npm ci && npx playwright install chromium && npm run verify` in the clone. It must pass.
3. Commit and push `main`. Netlify then runs the same gate before publishing.

The app's own unit and integration suite stays in `kodo-tests/` (`node kodo-tests/run.mjs`) and should also be run before a deploy.
