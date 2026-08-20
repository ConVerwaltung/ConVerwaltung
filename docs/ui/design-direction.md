# Visual direction

What AMTS looks like, and the rules that keep it looking like one thing. Assembled from
`.scratch/ui-design/` — the direction (`0005`), the token set (`0007`), the icon rules
(`0008`), the theme mechanism (`0003`) and the accessibility tooling (`0004`).

Companion documents: [`component-conventions.md`](./component-conventions.md) — the
vocabulary every screen applies — and [`screens.md`](./screens.md) — the per-route
information architecture. The styling approach itself is
[ADR-0009](../adr/0009-hand-rolled-css-tokens.md).

Domain terms come from [`CONTEXT.md`](../../CONTEXT.md) and are used verbatim in UI text.
UI text is hardcoded German, inline in components; there is no i18n layer. These documents
are English, written with the German terms.

---

## 1. Registratur

**Ink on cool paper.** A register: hairline rules carry the structure, borders never
shadows, near-monochrome with one accent. The app is a filing surface an organizer works
across a few times a year, not a dashboard.

Chosen 2026-08-09 against two alternatives rendered with real data at 1280px in both
themes. A people-first direction (~78px bands) was rejected on **findability** — a specific
name among 150 was reachable only by scrolling or by search, which makes search structural
instead of an affordance. A control-desk direction (26px rows, ~17 columns) had the wanted
density but overshot the amount.

Three consequences that bind every screen:

- **Findability is a requirement, not a nice-to-have.** Locating one name among 150 must
  never depend on the search field alone: sort, sticky header and a scannable name column
  carry it.
- **Density target: 36px rows, ~9 columns** at 1280px. That is the reference; 26px/17
  columns is the ceiling and 78px bands the floor.
- **Desktop-first at ~1280px.** A phone must remain usable, but is never the design target.
  Where the breakpoints fall is not decided (see [§9](#9-what-is-deliberately-not-decided)).

### Signature

**Rollen as fixed-width codes in a Vermerk column**, primary role bold and underscored,
further roles in `--ink-mute`. Role coverage then scans vertically instead of being 1,200
spelled-out checkboxes. The codes are read in the register and edited as toggles in the
detail row.

### Scale

50–150 Teilnehmer per Veranstaltung, 10–40 Veranstaltungen over the years, 142 Personen in
a real pool. The full table renders; there is no virtualization.

---

## 2. Type

Two families, both self-hosted. Nothing is fetched from a third party — ADR-0003.

| Face | Role |
|---|---|
| **Source Sans 3 Variable** | body, values, inputs, headings, the wordmark |
| **Inconsolata Variable** | codes, the Vermerk column, numerics |

Both ship as `@fontsource-variable` **devDependencies**, imported latin-only. They are
asset-only — CSS and woff2, no JavaScript — so the zero-new-runtime-dependency rule is read
as being about shipped JS. Variable axes mean one file per family covers every weight. Vite
hashes and emits the woff2 and Workbox precaches it, so the fonts are available offline.

```js
// src/routes/+layout.svelte
import '@fontsource-variable/source-sans-3/latin.css'; // 5.3.0, OFL-1.1
import '@fontsource-variable/inconsolata/latin.css'; // 5.3.0, OFL-1.1
import '$lib/styles/tokens.css';
import '$lib/styles/base.css';
```

**A third face was dropped.** The direction called for a letterspaced geometric label face
(`URW Gothic`) at 10px uppercase only. It is not on fontsource in any form, and the local
copy is `AGPL-3.0-only WITH PS-or-PDF-font-exception` — that exception covers embedding in
PostScript/PDF documents, **not** serving a woff2 from a web app, which would be plain AGPL
distribution with a corresponding-source obligation. At 10px and `0.16em` tracking the
geometric character is nearly invisible anyway: **the letterspacing is what makes a label
read as a label**, and that survives in Source Sans 3. The wordmark loses its one genuinely
distinct moment; the cost is accepted.

### Scale and weights

Six steps at base 14px (`--text-label` … `--text-xl`). The prototype's nine sizes
consolidated with 15px dropped, not 14 — the direction won on density, so unification goes
downward and column widths stay where they were judged.

**Weights and line-heights are conventions, not tokens**: 400 default, 600 emphasis, 700
codes and wordmark (no 500); 1.45 body, 1.2 headings. Only **tracking** is tokenised,
because letterspaced uppercase is the signature and the one value that drifts invisibly.
The label *bundle* — family + size + weight + tracking + uppercase — is a class, defined
once in [`component-conventions.md` §8](./component-conventions.md#the-label-bundle).

**rem throughout**, type *and* space, against a 16px root: a raised browser font size then
scales the whole app instead of clipping text inside a fixed row. `--radius` and border
widths stay px.

---

## 3. Colour

15 colour tokens plus a scrim, in one semantic layer. **No scale beneath** — no
`--gray-100`. The tokens components read are the tokens the contrast test checks, with no
alias level in between.

| Group | Tokens |
|---|---|
| Grounds | `--paper` `--surface` `--raised` `--inset` |
| States | `--hover` `--selected` `--on-accent` |
| Ink | `--ink` `--ink-mute` |
| Lines | `--rule` `--rule-hard` `--control` |
| Signals | `--accent` `--accent-hover` `--danger` `--focus` `--scrim` |

### Universal AA, not a pairing matrix

**Every text token clears 4.5:1 and every UI token 3:1 on *every* ground, in *both*
themes.** A component author has no pairing rule to remember and none to violate. The final
palette computes **0 failures** over the full six-ground matrix in both themes,
`--on-accent` on `--accent` (8.04 / 7.87) and on `--accent-hover` (10.08 / 9.37) included.

Two things were forced by that commitment rather than chosen:

- **`--ink-faint` does not exist.** A third ink level failed at 4.18 on `--selected` in
  dark; retuned to pass universally it landed 0.7 ratio from `--ink-mute`, surviving the
  test while carrying no meaning. Its jobs — 10px uppercase labels, row index, sub-names,
  legends — are distinguished by size, family and letterspacing. Colour was never the
  carrier. Any spec or prototype fragment still naming it is stale.
- **`--control` carries headroom**, worst ratio 3.34 / 3.31 rather than the 3.00 / 3.01 an
  exact solve gives. The margin is in the value; the test still asserts the WCAG numbers,
  4.5 and 3.0, so it states the standard and not a house rule.

### Three line tokens, because one cannot pass

A structural hairline is decorative and has no contrast floor; a border that identifies a
control needs 3:1. All three prototyped directions had to split them.

> **Naming rule: a border a pointer can act on is `--control`; everything else is `--rule`
> or `--rule-hard`.**

The direction is *borders carry the structure*, so structure gets its own two weights.
Merging them would make every change to `--control` silently restyle `thead` and the frame.

### Two hues, full stop

No `--danger-bg`, no `--success`. A destructive dialog reads as irreversible through
**wording** plus a `--danger` border and text, never a tinted panel. This satisfies *colour
is never the only signal* for free and keeps the contrast matrix at six grounds.

**No zebra striping**, for the same arithmetic: a stripe would be a fifth ground and every
ink token would have to clear 4.5:1 against it in both themes.

`filter: brightness()` is **banned** as a hover or state mechanism — it shifts
unpredictably between themes and is exactly the raw-value escape this file exists to
prevent. Each theme's hover moves *away* from its ground: light darkens, dark lightens.

---

## 4. Light and dark

OS default plus a manual override. The preference lives in `localStorage` under
`amts.theme` (`system | light | dark`) — **explicitly outside the Library**: never in
IndexedDB, never exported, never merged.

### One meeting point, no media query

**The CSS contains no `@media (prefers-color-scheme: …)` block at all.** Instead:

- `:root { color-scheme: light dark }` and every colour token written as `light-dark(a, b)`;
- `data-theme` on `<html>`, set **only** when an explicit override is stored — its absence
  means *system*;
- `:root[data-theme='light'|'dark'] { color-scheme: light|dark }` pins the scheme.

The UA's own `color-scheme` resolution becomes the single meeting point of OS setting and
override, so neither can silently win, an OS change is picked up with no JS listener, and
scrollbars and native form controls follow for free.

### Before first paint

An **inline script in `src/app.html`**, in `<head>` above `%sveltekit.head%`, reads
`localStorage` and sets the attribute. Verified to survive prerendering and precaching, and
to survive verbatim into the `404.html` SPA fallback. It is ES5-safe (`var`, `try`/`catch`,
no optional chaining) because it is template text, not a module Vite transpiles — and the
`try`/`catch` is required, not defensive: `localStorage` *throws* when storage access is
denied.

`src/lib/theme.svelte.ts` is the runtime mirror of that script. **Keep the two in sync** —
the comment in `app.html` says so, and it is the one duplication in the design.

### `theme-color`

Two media-scoped `<meta name="theme-color">` tags — the one element this design permits a
`prefers-color-scheme` query for, because a `<meta>` has no other mechanism. They follow the
**OS**, so `theme.svelte.ts` rewrites both `content` values while an override is active.

```html
<meta name="theme-color" content="#fbfbf9" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1b2023" media="(prefers-color-scheme: dark)" />
```

The browser UI band continues the `--surface` header with no seam. The **manifest keeps
single light values** (`theme_color: '#fbfbf9'`, `background_color: '#f1f2ee'`) because a
manifest cannot be theme-aware: `color_scheme_dark` is unsupported and absent from
vite-plugin-pwa's types. A dark-mode organizer gets one light splash frame before the app
paints, which this design has no way to avoid. This replaces the incoherent
`theme_color: '#1f2937'` against `background_color: '#ffffff'` in the current config,
neither of which is from any palette.

---

## 5. Icons

**Icons broadly** — a knowing departure from the zero-SVG prototype, taken for reach. The
rules below are what keep it from reading as a generic dashboard.

> **Icon + word wherever a control appears once. Icon-only solely where a control repeats
> per row.**

A row is the only place a German verb costs anything: at 150 Teilnehmer × 3 actions the
verbs are a wall; at one toolbar button they are the label. The precise verbs
(`Abgleich vorbereiten`, `Als Teilnehmer hinzufügen`, `CSV herunterladen`) stay intact
everywhere they carry meaning.

**The destructive carve-out.** Scoped removes may go icon-only in `--danger`.
**`Löschung …` keeps its word, always** — it reaches across every Veranstaltung and cannot
be undone (ADR-0005), and it must not look identical to a scoped remove *before* the click.

**Source: vendored Lucide path data, zero dependencies** — runtime or dev.

```
src/lib/icons/
  Icon.svelte      <svg width=1em height=1em stroke=currentColor …><path d={…}>
  icons.ts         { pencil: 'M…', 'trash-2': 'M…', … }
  LICENSE-lucide   ISC, vendored with the paths it covers
```

A build-time icon package costs two devDeps and a plugin in the build path for a set of
~20; a `static/icons.svg` sprite with `<use>` must be explicitly precached or the icons
vanish offline, which is precisely the failure ADR-0003 cannot tolerate. Vendoring puts
every byte under version control and removes both risks.

**Geometry is re-cut to the register**: `stroke-linecap: butt`, `stroke-linejoin: miter`,
`stroke-width: 1.5`, optically fitted to a 16px box. Round caps and joins are what make a
borrowed set read as borrowed; square terminals put the glyphs in the same voice as the
hairlines that carry the structure. A true 1px hairline was rejected — at 13–16px on a 1×
display, thin diagonals alias into illegibility.

**Sizing adds no tokens**: `1em` square, `currentColor`, no size prop, so an icon scales
with the text it sits in and inherits an already-passing ink token. The WCAG 2.5.8 AA
24×24 target floor is `.icon-btn` padding — a convention, not a token. It fits inside the
36px row.

**One vocabulary.** The typographic marks `°` (Person-Feld) and `¶` (Notiz) retire; both
become glyphs from the same set, so the legend explains icons rather than characters. The
set stays **open**, keyed by shape name — which means glyph divergence (`pencil` here,
`square-pen` there) is an accepted, unguarded risk resting on review against the
**Aktionsvokabular** in [`component-conventions.md` §2](./component-conventions.md#2-icons).

---

## 6. Accessibility

The commitment is **WCAG 2.2 level AA**, and it is enforced where it can be enforced rather
than only asserted.

### The rules

1. **Contrast**: 4.5:1 for text, 3:1 for UI borders and focus rings — universally, per
   [§3](#universal-aa-not-a-pairing-matrix).
2. **Full keyboard operability**, native-first: see
   [`component-conventions.md` §13](./component-conventions.md#13-tastatur-und-fokus).
   No global shortcuts exist, deliberately.
3. **Visible focus**, declared once globally so no component can restate it:
   ```css
   :focus-visible {
   	outline: 2px solid var(--focus);
   	outline-offset: 1px;
   }
   ```
4. **Associated labels** everywhere, including a visually-hidden `.vh` label on every inline
   editor. A placeholder is never a label.
5. **Colour is never the only signal.** Any state carried by a ground also carries a word,
   an icon, or an ARIA state.
6. **Target size**: 24×24 CSS px minimum on icon-only controls (WCAG 2.5.8 AA).
7. **Nothing animates.** No motion tokens, no spinners — which removes the whole
   reduced-motion class of problem.

### Three checking layers

| Layer | What it is | Cost | What it catches |
|---|---|---|---|
| **1 · Compiler** | `svelte-check --compiler-warnings "<42 codes>:error"` | 0 deps | static per-element a11y rules, build-blocking |
| **2 · Token contrast** | `src/lib/styles/tokens.test.ts` over `tokens.css` | 0 deps | the AA contrast commitment, **alone** |
| **3 · jsdom + axe-core** | `@testing-library/svelte` + `jsdom` + `axe-core` | 3 devDeps, ~11 MB | cross-component label/aria/table defects |

**Layer 2 carries the contrast commitment by itself, because axe-core cannot check contrast
without a real browser and fails *open*** — `colorContrastEvaluate` returns a pass for
anything not visible on screen, and jsdom performs no layout. The test parses `tokens.css`
off disk and regexes every `light-dark(a, b)` pair into a light map and a dark map, so the
values under test are literally the values that ship. It **fails closed**: four
classification lists plus an assertion that every colour token appears in at least one, so
adding a token without classifying it fails the suite.

```ts
// The classification, as tokens.test.ts must carry it.
GROUNDS = ['--paper', '--surface', '--raised', '--inset', '--hover', '--selected'];
TEXT = ['--ink', '--ink-mute', '--accent', '--danger'];
UI = ['--control', '--focus'];
DECORATIVE = ['--rule', '--rule-hard', '--scrim'];
// Explicit pairs, not matrix grounds: --on-accent on --accent and on --accent-hover.
```

"At least one", not "exactly one", because `--accent` is both a text colour and the filled
button's ground. `--accent-hover` is deliberately **not** a matrix ground — adding it would
widen universal AA to seven grounds for one button state. `--scrim` is `DECORATIVE`, a
translucent overlay with no floor, and is written as **8-digit hex** so the test's regex
stays hex-only.

**Layer 3 is adopted** — the one call this map left open, settled here. Three reasons:

- ADR-0008 already names `@testing-library/svelte` as part of the intended test stack, so
  this is not a new architectural direction, and `vite.config.ts` already splits
  `*.svelte.test.ts` out of the `server` project — the wiring exists.
- The design creates one specific defect **multiplied by 150**: each Import decision radio
  group needs its own accessible name, and a missing group name is exactly what axe catches
  and the compiler cannot see.
- The rest of what it catches is the shape of these screens: `label`/`for`-`id` resolution
  across the single `openEditor` component, `th-has-data-cells` and `td-headers-attr` on
  four registers, `aria-hidden-focus` on the dialog, `nested-interactive` in row actions.

It is scoped rather than blanket: **the four registers, the dialog, the Import decision
group, and the app frame** — not a snapshot suite over every component. Vitest Browser Mode
with Playwright stays deferred: browser binaries plus a CI step that does not exist, for a
headline benefit layer 2 already covers.

### What stays manual

Unautomatable at every layer, and therefore a **review checklist**, not a test:

- **visible focus** — no compiler warning, no ESLint rule, no axe rule exists;
- **the arrow layer** over registers;
- **both skip links** (`Zum Inhalt`, `Register überspringen`);
- **glyph divergence** against the Aktionsvokabular.

`eslint-plugin-svelte` contributes nothing here: it has **no a11y rules at all**, and its
only route (`svelte/valid-compile`) has no per-code severity and resolves warning filters
only from a literal `svelte.config.js`, which this repo does not have.

---

## 7. The token file

[`src/lib/styles/tokens.css`](../../src/lib/styles/tokens.css) — **41 tokens**, nothing but
`:root` custom properties and the two `data-theme` narrowings. Everything else lives in
`src/lib/styles/base.css`: the reset, `body` defaults, `:focus-visible`, link defaults. The
split exists for the test — its parse target must be a file where every declaration is a
token, so a regex cannot mistake a rule for a value.

Beyond colour: two font families, three tracking values, six type steps, eight space steps,
five structural tokens.

**Eight space steps, fitted to use rather than to a 4px grid.** `--space-4` is 10px because
table-cell padding is load-bearing: at nine columns it is the difference between the row
fitting 1280px and not. A 4px grid would have moved it to 8 or 12 and rewidened every
column. (The prototype's `54px` is not a spacing step — it is the detail panel aligning
under the index column, 42px + 12px. Derived, not a token.)

**Five structural tokens**: `--radius`, `--row` (the density governor), `--frame-h`,
`--sidebar-w`, `--sheet-max`. The last three are the frame geometry, tokenised so the
phone-degradation work redefines one block instead of hunting literals across components.

### The rule that governs additions

1. A value earns a token only if it is **theme-aware**, or appears in **two or more
   components**.
2. Colour tokens are named for their **role** — ground, ink, line, signal — never for their
   hue or their component.
3. Every new colour token must be added to a classification list in `tokens.test.ts`, which
   fails until it is.
4. Sizes are **rem**; `--radius` and border widths are **px**.

### Deliberately not tokens

- **No z-index scale.** Dialogs are native `<dialog>`, which renders in the top layer above
  every stacking context. The only z-index in the app is the sticky `thead`'s literal `2`.
- **No breakpoints.** Custom properties cannot be used inside `@media` queries at all, so
  they would be documentation posing as tokens.
- **No shadow, motion or opacity tokens.** The direction has none: borders never shadows,
  and nothing animates.
- **No component-scoped tokens** (`--button-bg` and the like). A component composes the
  existing set.
- **No focus-ring width or offset token.** The ring is declared once globally, so `--focus`
  is the only part a component could get wrong.

---

## 8. What was decided about the app, not the pixels

Recorded here because they are design constraints a later reader will otherwise
re-litigate:

- **New capabilities are limited to presentation-only affordances**: client-side search,
  sort, collapsible sections, empty states, dialogs replacing `window.confirm`. **Nothing
  stores new data.** No saved filters, no saved list views, no tags, no undo history, and no
  stored preference other than the theme.
- **Missing edit paths over existing records are in scope**, because they are absent
  controls over records that already exist rather than new kinds of data: renaming a Person,
  and managing Export-Ansichten and Import-Zuordnungen.
- **No Veranstaltungsdatum exists and none is introduced.** `Angelegt` is the UUID v7
  timestamp already inside the record id. The consequence is stated on the screen it binds:
  the Übersicht orders by creation and **cannot** mark a Veranstaltung as past.
- **Nothing in the UI ever tells the organizer whether the app is offline-capable.** Both
  remaining service-worker callbacks are silent. This is consistent with an app that never
  reports its own health, and it is named here so it is not read as a gap.

## 9. What is deliberately not decided

**Phone degradation.** Desktop-first is settled; where the breakpoints fall and what
collapses at each one is not, and could not be stated before the desktop layouts existed.
The named cases waiting for that work:

| Case | The problem |
|---|---|
| The sidebar | `--sidebar-w` (200px) permanent at 380px is not viable |
| The Teilnehmer register | nine columns |
| The detail row | a `1fr 22rem` two-column grid |
| The Import register | the widest table in the app: two sticky columns, a `<select>` in every head cell, a four-way radio group per row |
| The Personen-Pool | six columns; the Übersicht five |
| The Export preview | a **ten-column file** — horizontally scrolled at 1280px already, and it cannot collapse to one column without ceasing to be a preview of a file |
| Stammdaten | two new sidebar sub-entries |

One phone rule needed no breakpoint and is already in the conventions: **row actions are
always visible under `@media (pointer: coarse)`**, because the hover reveal has no touch
equivalent.

**The deployment target**, which is a hosting question, not a UI one: no ADR, README or doc
names a host, the path-parameter routes need a rewrite rule the host must provide, and on an
exact-files-only host the service worker cannot install at all — already true today. Stated
as a constraint in [ADR-0008](../adr/0008-svelte-vite-typescript-stack.md) and in the build
backlog; deciding it is a separate effort.
