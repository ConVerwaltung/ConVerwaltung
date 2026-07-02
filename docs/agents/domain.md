# Domain docs

How the engineering skills should read this repo's domain documentation.

## Layout

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` directory at the repo root.

- `CONTEXT.md` — the domain glossary. The canonical vocabulary for this project.
- `docs/adr/` — architectural decision records, numbered `NNNN-slug.md`.

## Consumer rules

- **Always read `CONTEXT.md` first** when working on domain logic. Use its exact terms in code, comments, tests, and issues.
- **Check `docs/adr/` for relevant decisions** before changing architecture. If a change contradicts an ADR, surface it rather than silently diverging.
- When you resolve a new domain term or make an architectural decision, offer to update `CONTEXT.md` or add an ADR — don't let the docs drift.

## Notes

- This file documents *where* the domain docs live and *how* to consume them. The actual domain content lives in `CONTEXT.md` and `docs/adr/`.
- If this grows into a multi-context monorepo, switch to a `CONTEXT-MAP.md` at the root and per-context `CONTEXT.md` files.
