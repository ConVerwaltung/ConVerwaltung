# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

AMTS (Adaptives Teilnehmer-Management-System) — event participant management: import participant lists, enrich with custom data and notes, export structured views. Architecture and domain language are fully specified in docs. **Implementation has started**: the SvelteKit PWA scaffold exists (app shell only, no domain features yet). Not a git repository.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (static site in `build/`, service worker generated)
- `npm run preview` — serve the production build locally
- `npm run test` — Vitest, single run (`npm run test:unit` for watch mode)
- `npm run lint` — ESLint
- `npm run check` — `svelte-kit sync` + `svelte-check` (TypeScript)

## Documentation layout

- `CONTEXT.md` — the domain glossary. **Read first before any domain work.** Use its exact terms (with the listed "avoid" words banned) in code, comments, tests, and issues.
- `docs/adr/NNNN-*.md` — architectural decision records. Check before any architectural change; if a change contradicts an ADR, surface it rather than silently diverging. New domain terms or decisions → offer to update CONTEXT.md or add an ADR.
- `docs/agents/` — conventions for engineering skills (issue tracker, triage labels, domain-doc consumption).
- `docs/ui/` — the UI design package: `design-direction.md` (visual direction, palette, accessibility rules), `component-conventions.md` (the shared vocabulary — buttons, writes, tables, dialogs, editing, keyboard), `screens.md` (per-route information architecture). Binding for any UI work; the token file it governs is `src/lib/styles/tokens.css`.

## Architecture (decided in ADRs, binding for implementation)

- **Stack: SvelteKit (Svelte 5 runes) + Vite + TypeScript** (ADR-0008). Static adapter, whole app prerendered/client-rendered — no server runtime. PWA via `@vite-pwa/sveltekit` (wraps `vite-plugin-pwa`); tests via Vitest. The Library is held in `$state`; domain modules stay framework-free (no `svelte` imports).
- **Offline-first PWA, no server, no sync** (ADR-0003). All data lives in the browser's IndexedDB on one device. Personal data must not touch a third-party server.
- **Plain `idb` store + in-memory Library** (ADR-0006). The whole Library loads into memory at boot and is the single source of truth; IndexedDB is a thin write-through persistence edge. Domain logic stays pure and synchronous over in-memory state; unit tests run against plain objects, `fake-indexeddb` covers the persistence edge only. Local-first/sync databases (RxDB, Yjs, Replicache, …) are deliberately rejected — do not introduce one.
- **Keys are UUID v7** via the `uuid` package (native `crypto.randomUUID()` is v4-only).
- **Minimal built-in schema** (ADR-0002). Only `Person.name`, Participant structure (`event`, `person`, `roles`), and one Note field each. No built-in email/phone/address — their absence is deliberate; everything else is an organizer-defined Custom Field (Person-level = global, Participant-level = per event).
- **Import matching is interactive fuzzy review, not key-based upsert** (ADR-0001). Two-phase: parse → propose name-similarity candidates → organizer confirms per row → commit. Cannot run headless.
- **Erasure** (ADR-0005). Deleting a Person removes them and all their Participants, custom values, and notes across every event — the data-protection path. Orphan Persons (zero Participants) are otherwise retained.
- **Merge is deferred** (ADR-0007). Initial release is single-device: no Library file transfer, no field-level three-way merge, no per-field change-tracking metadata on records. ADR-0004 (merge design) and the merge-override part of erasure stand for later, but do not build them or their bookkeeping now.

## Issue tracker

Local markdown files under `.scratch/<feature-slug>/NNNN-<issue-slug>.md` — no remote tracker. Frontmatter: `title`, `labels`, `status: open|closed`, `created`. Numbers are sequential per feature directory. Triage labels (verbatim): `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Details: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`.
