# AMTS

Adaptives Teilnehmer-Management-System — offline-first PWA for event participant management: import participant lists, enrich with custom data and notes, export structured views.

Runs entirely in the browser (SvelteKit + static adapter, no server); all data stays on the device in IndexedDB. See `CONTEXT.md` for the domain glossary and `docs/adr/` for architecture decisions.

## Commands

```sh
npm install
npm run dev      # dev server
npm run build    # production build → build/
npm run preview  # serve the production build
npm run test     # Vitest (single run)
npm run lint     # ESLint
npm run check    # svelte-check (TypeScript)
```

## Hosting

Deployed to GitHub Pages from `main` by `.github/workflows/deploy.yml`: it builds the static
site and uploads `build/` as the Pages artifact. The repository's Pages source must be set to
**GitHub Actions** (Settings → Pages) once; nothing else is configured by hand.

The site is a *project* site, so it lives under `/<repo>/` rather than at the origin root.
The workflow passes that prefix as `BASE_PATH`, which `vite.config.ts` feeds into
`kit.paths.base` and into the manifest's `scope`/`start_url`. A local `npm run build` leaves
`BASE_PATH` unset and therefore builds for the root — fine for `npm run preview`, but that
output is not what gets deployed.

`build/` is a static directory, but **it cannot be served as plain files.** Any host must meet
two requirements:

- **Answer unknown paths with the SPA fallback document `404.html`.** Routes carrying a key in
  the path — `/event/<id>/…`, `/person/<id>` — have no file of their own. Without that, a
  first-ever deep link fails, because the service worker that would answer it is not installed
  yet. Once the app is installed the fallback is no longer on the path (`start_url` is the app
  root), but a shared link still is. GitHub Pages does this by default — it serves `404.html`
  for every unmatched path, though with an HTTP 404 status; the document boots the app anyway.
  A host with a real rewrite rule would serve the same file with a 200.
- **Serve every file under `build/`, including those the app never links to.** On a host that
  exposes only an explicit file list, the first 404 aborts the whole service-worker precache
  and the app never becomes offline-capable.

`static/.nojekyll` is empty on purpose: it stops Jekyll from stripping the `_app/` directory
should the site ever be served from a branch instead of the Actions artifact.

`file://` does not work: ES modules are CORS-blocked from a `null` origin.

See [ADR-0008](docs/adr/0008-svelte-vite-typescript-stack.md), Amendment 2026-08-20.
