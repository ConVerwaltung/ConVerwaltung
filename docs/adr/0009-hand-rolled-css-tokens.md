# Hand-rolled CSS custom properties and Svelte scoped styles, not a framework or component library

The app is styled by a single semantic token file — `src/lib/styles/tokens.css`, 41 CSS
custom properties — plus a small `base.css` and per-component Svelte `<style>` blocks. No
CSS framework, no component library, no headless primitive library, no CSS-in-JS: **zero new
runtime dependencies**. Light and dark are one palette written with `light-dark()` under
`color-scheme`, with the organizer's override held in `localStorage` — deliberately outside
the Library.

Full detail: [`docs/ui/design-direction.md`](../ui/design-direction.md),
[`docs/ui/component-conventions.md`](../ui/component-conventions.md), and
[`docs/ui/screens.md`](../ui/screens.md). The decisions behind them are recorded in
`.scratch/ui-design/`.

## Why

[ADR-0003](./0003-offline-first-pwa.md) makes the app an offline-first PWA that ships
everything it needs; [ADR-0006](./0006-plain-store-in-memory-model.md) rejects heavy
libraries on principle, on the argument that the complexity worth owning is the project's
own. Styling is the clearest case of that: AMTS is one organizer's register at ~1280px, with
four tables, one dialog grammar and one editor. The surface a framework would cover is small
enough to write, and the parts that actually carry risk — the AA contrast commitment, the
theme mechanism, the density of a 150-row table — are exactly the parts a framework does not
decide for you.

Svelte's scoped styles already solve the problem CSS frameworks exist to solve. A `<style>`
block in a component cannot leak, so there is no cascade to defend against and no naming
convention to maintain. What remains is the shared vocabulary — colour, type, space — and a
custom property file is the smallest thing that expresses it while being **readable by the
UA at runtime**, which is what makes a single-file dual theme possible at all.

The theme mechanism follows from the same logic. `color-scheme: light dark` with
`light-dark()` tokens means **the CSS contains no `prefers-color-scheme` query anywhere**:
the UA's own scheme resolution is the single meeting point of the OS setting and an explicit
override, so neither can silently win and an OS change needs no listener. A media-query
fallback guarded by `:not([data-theme])` would work, but it puts the two inputs in two places
and invites a cascade race. `light-dark()` is Baseline 2024; a single-organizer PWA on a
current browser makes that safe, and the choice is recorded here because it dictates how
every colour token is written.

## Considered options

- **Tailwind** — rejected: it moves the vocabulary into class strings in markup, where the
  contrast commitment cannot be tested. This design's AA guarantee rests on a unit test that
  parses the token values off disk; utility classes have no such single parse target. It also
  adds a build-step dependency and a second naming system beside Svelte's scoping, which
  already prevents leakage.
- **A component library (Skeleton, Flowbite, shadcn-svelte, Bits UI / Melt)** — rejected: the
  app needs a register, a dialog, an inline editor and a segmented radio group. Native
  `<dialog>`, `<details>` and `<table>` cover three of them with correct semantics and no
  bytes, and the fourth is four radios. A library would ship a design voice that has to be
  overridden, and its dialogs and menus bring the portal/z-index machinery this design
  deliberately has none of.
- **A scale-based token layer beneath the semantic one** (`--gray-100` under `--ink-mute`) —
  rejected: an alias level between what components read and what the test checks. With one
  organizer and one direction there is no second palette to swap.
- **CSS-in-JS / vanilla-extract** — rejected: runtime or build weight for scoping that
  Svelte already provides.
- **`:not([data-theme])`-guarded `prefers-color-scheme` media queries** — viable, rejected as
  above: two places where the OS and the override meet instead of one.

## Consequences

- **The AA commitment lives in one unit test.** `src/lib/styles/tokens.test.ts` parses
  `tokens.css` off disk, so the values under test are the values that ship, and it **fails
  closed**: every colour token must appear in a classification list or the suite fails. This
  matters because `axe-core` cannot check contrast without a real browser and **fails open**
  — no other layer enforces contrast at all.
- **Every text token clears 4.5:1 and every UI token 3:1 on every ground, in both themes** —
  universal AA rather than a pairing matrix. The cost is paid in the palette, not by
  component authors: it deleted a third ink level that could not pass, and it caps the number
  of grounds, which is why there is no zebra striping and no `--danger` background.
- **`tokens.css` must stay pure** — nothing but `:root` custom properties and the two
  `data-theme` narrowings — or the test's parse target stops being trustworthy. The reset and
  `:focus-visible` live in `base.css` for that reason.
- **Three dev dependencies are accepted, none of them runtime.** Two
  `@fontsource-variable` packages (asset-only: CSS and woff2, no JavaScript) ship the two
  self-hosted faces; `jsdom` + `@testing-library/svelte` + `axe-core` (~11 MB) catch the
  cross-component label/ARIA/table defects the Svelte compiler cannot see — most concretely
  a missing accessible name on a per-row radio group, a defect the Import review multiplies
  by 150. `@testing-library/svelte` was already named in
  [ADR-0008](./0008-svelte-vite-typescript-stack.md), so this extends an existing intent
  rather than opening a new one. Icons are **vendored Lucide path data** with the ISC
  licence, so the icon set costs nothing at all — a sprite was rejected because it must be
  explicitly precached or the icons vanish offline.
- **Svelte compiler a11y warnings become build failures** via `svelte-check
  --compiler-warnings`, enumerating all 42 `a11y_*` codes — no wildcard is supported. This
  makes the two existing `svelte-ignore a11y_autofocus` suppressions load-bearing; they
  disappear with the single `openEditor` that replaces `autofocus`.
- **The theme preference is not Library data.** `localStorage` under `amts.theme`, never
  IndexedDB, never exported, never merged — so it does not become a record that
  [ADR-0004](./0004-field-level-three-way-merge.md)'s merge would one day have to reconcile.
- **One duplication is accepted**: the pre-paint inline script in `src/app.html` mirrors
  `applyTheme()` in `src/lib/theme.svelte.ts`. It cannot be shared — the script must run
  before any module loads, and it is untranspiled template text, so it stays ES5-safe. Both
  sites carry a comment saying so.
- **A Content-Security-Policy would break this.** None exists today. If one is added, nonces
  are fatal under prerendering (Kit throws) and Kit hashes only its own bootstrap, so the
  `app.html` script would need a hand-maintained `'sha256-…'`. The escape hatch is moving it
  to `static/theme.js` and accepting one blocking request.
- **The manifest cannot be theme-aware.** `theme_color` and `background_color` keep single
  light values, so a dark-mode organizer sees one light splash frame before the app paints.
  There is no mechanism to avoid this.
- **Adding a token is governed, not free**: it must be theme-aware or used in two or more
  components, named for its role rather than its hue, classified in the test, and expressed
  in `rem` unless it is a radius or a border width. Component-scoped tokens
  (`--button-bg`) are not permitted; a component composes the existing set.
- **Phone layout is not decided by this ADR.** Breakpoints deliberately have no tokens —
  custom properties cannot be used inside `@media` queries at all — and where they fall is
  open work. The frame geometry (`--sidebar-w`, `--frame-h`, `--sheet-max`) is tokenised so
  that work redefines one block rather than hunting literals.
