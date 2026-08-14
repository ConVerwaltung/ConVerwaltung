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

`build/` is a static directory, but **it cannot be served as plain files.** The host must
meet two requirements:

- **Rewrite unknown paths to `/200.html`** (HTTP 200, not a redirect). Routes carrying a key
  in the path — `/event/<id>/…`, `/person/<id>` — have no file of their own; they are served
  by that SPA fallback document. Without the rewrite, a first-ever deep link 404s, because
  the service worker that would answer it is not installed yet. Once the app is installed
  the rewrite is no longer on the path (`start_url` is `/`), but a shared link still is.
- **Serve every file under `build/`, including those the app never links to.** On a host that
  exposes only an explicit file list, the first 404 aborts the whole service-worker precache
  and the app never becomes offline-capable.

`file://` does not work: ES modules are CORS-blocked from a `null` origin.

No deployment target is chosen yet — see
[ADR-0008](docs/adr/0008-svelte-vite-typescript-stack.md), Amendment 2026-08-13.
