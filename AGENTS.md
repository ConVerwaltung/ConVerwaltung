# AMTS

Adaptives Teilnehmer-Management-System — see `CONTEXT.md` for the domain glossary and `docs/adr/` for architectural decisions.

## Project context

Event participant management: import participant lists, enrich them with custom data and notes, export structured views. Offline-first SvelteKit PWA (Svelte 5 runes, TypeScript, static adapter) — no server, no sync; all data lives in the browser's IndexedDB. Domain modules stay framework-free; the Library is held in memory as the single source of truth with IndexedDB as a write-through persistence edge.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/` (one directory per feature, e.g. `.scratch/initial-release/`) — no remote tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### UI design

`docs/ui/` holds the design package — `design-direction.md`, `component-conventions.md`, `screens.md` — binding for any UI work, with [ADR-0009](docs/adr/0009-hand-rolled-css-tokens.md) recording the styling approach and `src/lib/styles/tokens.css` as the only place a raw colour or size appears.
