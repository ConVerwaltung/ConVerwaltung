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
