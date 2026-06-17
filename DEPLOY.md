# WakeForce — Deployment Guide

WakeForce is a pure client-side PWA. There is no backend, no server, and no environment variables. The entire app ships as static files from `dist/`.

**Primary recommendation: Netlify.** It provides zero-config HTTPS, automatic SPA routing via `netlify.toml`, and a single CLI command to ship. Vercel is a fully supported alternative — both config files are included.

---

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- For Netlify: `npm install -g netlify-cli`
- For Vercel: `npm install -g vercel`

---

## Local Development

```sh
npm install
npm run dev
# App runs at http://localhost:3000
```

> Note: Service Workers require HTTPS or `localhost`. They will register correctly on `localhost` during development.

---

## Production Build

```sh
npm run build
# Output: dist/
```

Vite copies everything in `public/` (including `service-worker.js` and `icons/`) directly into `dist/` as-is. No special handling needed.

---

## Deploy to Netlify (primary)

```sh
# First deploy — links the project to a Netlify site
netlify deploy --prod --dir=dist

# Subsequent deploys
netlify deploy --prod --dir=dist
```

Alternatively, connect the Git repository in the Netlify dashboard. Netlify will pick up `netlify.toml` automatically and run `npm run build` on every push to `main`.

---

## Deploy to Vercel (alternative)

```sh
# First deploy — follow the interactive prompts
vercel --prod

# Subsequent deploys
vercel --prod
```

`vercel.json` is already configured. Vercel will detect the Vite project and use the settings from the file.

---

## Post-Deploy Checklist

After the first production deploy, verify the following:

- [ ] Site loads over HTTPS (padlock visible in browser)
- [ ] No mixed-content warnings in DevTools console
- [ ] Service Worker is registered: DevTools > Application > Service Workers shows `service-worker.js` as "Activated and running"
- [ ] PWA is installable: browser shows "Add to Home Screen" / install prompt, or DevTools > Application > Manifest shows no errors
- [ ] Camera permission prompt appears on the wake detection screen
- [ ] Hard refresh (`Ctrl+Shift+R`) still loads the app (confirms SW caching works)
- [ ] Direct URL navigation to a sub-route returns the app, not a 404 (confirms SPA redirect rule works)

---

## Notes on HTTPS Requirement

Service Workers and `getUserMedia` (camera access) are only available in secure contexts — HTTPS or `localhost`. Both Netlify and Vercel provision TLS certificates automatically. Do not serve this app over plain HTTP in production.
