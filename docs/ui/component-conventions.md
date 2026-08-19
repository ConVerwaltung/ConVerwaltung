# Component conventions

The shared vocabulary every AMTS screen applies, so five routes do not each invent their
own. Settled 2026-08-11 in `.scratch/ui-design/0009-component-conventions.md`, and revised
three times since:

| When | By | What changed |
|---|---|---|
| 2026-08-11 | *Design the event screen* | edits of existing records lose their `Speichern` button and their `Gespeichert` Quittung (§0.1, §3, §5, §7) |
| 2026-08-12 | *Design the export view screen* | §6 gains a named exception: the single primary action of a row may stay visible |
| 2026-08-13 | *Decide the keyboard scheme* | §13 added — the whole scheme, all new ground |
| 2026-08-13 | *Decide the service-worker update UX* | §3's banner becomes a frame banner with **two severities**; §7's dialog table gains the reload confirm |

Companion documents: [`design-direction.md`](./design-direction.md) — the visual direction,
type, palette and accessibility rules — and [`screens.md`](./screens.md) — the per-route
information architecture.

Binding inputs: [ADR-0002](../adr/0002-minimal-built-in-schema.md) (minimal schema),
[ADR-0003](../adr/0003-offline-first-pwa.md) (offline, no server),
[ADR-0005](../adr/0005-person-erasure.md) (Erasure),
[ADR-0006](../adr/0006-plain-store-in-memory-model.md) (in-memory Library),
and the map's earlier tickets — the visual direction (*Registratur*), the navigation model
(*Werkbank*), the token set, and the icon rules.

Domain terms come from [`CONTEXT.md`](../../CONTEXT.md) and are used verbatim in UI text.

---

## 0. The rules that govern everything else

1. **No write announces itself.** Edits persist as they are made; success is never
   reported. Only two things reach the organizer: a **failure**, and an **effect they
   cannot see**. (§3)
2. **`--danger` marks controls that remove stored records, and states where stored data is
   lost or at risk. Nothing else.** A discarded draft was never stored, so it is not
   `--danger`.
3. **The `Lösch-` stem is reserved for Erasure.** Every scoped removal is `Entfernen`.
   `CONTEXT.md` lists *Delete, removal* under _Avoid_ for exactly this reason.
4. **Submit buttons are disabled only while busy — never for validity.** (§4)
5. **A disabled control always shows a visible reason.**
6. **Colour is never the only signal.** Any state carried by a ground must also carry a
   word, an icon, or an ARIA state.
7. **Nothing animates.** There are no motion tokens and no spinners.

---

## 1. Buttons

### Shapes — three, not four

| Shape | Treatment | Used for |
|---|---|---|
| **Primary** | filled `--accent`, `--on-accent` text, `--radius` | the one commit action per form |
| **Secondary** | `--surface` ground, 1px `--control`, `--ink` text | alternates, `Abbrechen` |
| **Quiet** | no ground, no border, `--ink-mute`, underline on hover | row actions, tertiary controls |

**Destructive is a modifier, not a fourth shape** — `--danger` replaces the ink (and
border) of Secondary or Quiet. There is no filled-red button anywhere; `--on-danger` does
not exist and the palette is deliberately two hues.

### States

| State | Treatment |
|---|---|
| hover, Primary | ground → `--accent-hover` |
| hover, Secondary / Quiet | ground → `--hover` |
| focus | the global `:focus-visible` ring — components never restate it |
| disabled | `--ink-mute` on `--raised`, border stays `--control`, `cursor: default`, **plus a visible reason** |
| busy | label swaps (`Importieren` → `Wird importiert …`), `aria-busy="true"`, disabled, **width held** so the layout does not jump |

`filter: brightness()` is banned as a hover mechanism — it shifts unpredictably between
themes. Spinners are banned; the busy state is carried by the label.

### The three destructive severities

They must not look alike before the click. Two axes separate them — **word** and **weight**:

| Severity | Word | Weight | Confirmation |
|---|---|---|---|
| Scoped remove — Teilnehmer, Rolle, Custom Field, Export-Ansicht | `Entfernen` | Quiet + `--danger`; **icon-only inside repeating rows** | Confirm dialog with the cascade sentence |
| Delete a Veranstaltung | `Veranstaltung entfernen …` | Quiet + `--danger`, **word always** | Confirm dialog with the cascade sentence |
| **Erasure of a Person** | `Löschung …` | **Secondary + `--danger` border** — the only bordered destructive control in the app | **Type-to-confirm** dialog |

A trailing `…` means a further step follows, so it marks the two destructive controls that
carry a word *and* open a dialog. Icon-only removes cannot carry it, which is consistent
rather than an exception.

---

## 2. Icons

Governed by `.scratch/ui-design/0008-icons.md`. Two additions settled here.

### `Icon.svelte` takes a required `label`

`label: string | null`, **no default**, so TypeScript refuses a call site that has not
decided which of the two naming mechanisms applies:

```svelte
<Icon name="pencil" label={null} />          <!-- aria-hidden: decorative, inside a labelled button -->
<Icon name="user"   label="Person-Feld" />   <!-- role="img" + <title>: annotates content -->
```

A default is precisely what would make the wrong branch silent.

### Aktionsvokabular

The icon set is open and keyed by shape name, so nothing mechanical prevents `pencil` on
one screen and `square-pen` on another for the same act. This table is the canonical
answer; extend it rather than picking a glyph ad hoc.

| Action | Shape |
|---|---|
| Bearbeiten | `pencil` |
| Entfernen (scoped) | `trash-2` |
| Notiz | `message-square-text` |
| Person-Feld (veranstaltungsübergreifend) | `globe` |
| Teilnehmer-Feld (nur diese Veranstaltung) | `calendar` |
| Hinzufügen | `plus` |
| Duplizieren | `copy` |
| Suchen | `search` |
| Import | `file-input` |
| Export | `file-output` |
| Herunterladen | `download` |
| Einrichtung | `sliders-horizontal` |
| Teilnehmer | `users` |
| Veranstaltungen | `calendar-days` |
| Stammdaten | `library` |
| Spalte nach oben / nach unten | `arrow-up` / `arrow-down` |
| Aufklappen / zuklappen | `chevron-right` / `chevron-down` |
| Schließen | `x` |
| Warnung, Fehler | `triangle-alert` |
| Verknüpfen (Import) | `link` |
| Neu anlegen (Import) | `user-plus` |
| Überspringen (Import) | `ban` |
| In andere Veranstaltung übernehmen | `calendar-plus` |

`copy` (*Duplizieren*) and `calendar-plus` (*Übernehmen*) are deliberately distinct:
duplicating stays at the same level, übernehmen crosses into another Veranstaltung.

---

## 3. Writes

25 persisted writes exist. The governing rule is §0.1: **none of them says it worked.**

### Editing an existing record has no Speichern button

A Notiz, a custom value, a Rolle, a name — the edit persists **on change for a control,
on blur or `Enter` for a text field** (§5). There is no commit button and no
acknowledgement, because the store is a local IndexedDB on one device: the write is
sub-millisecond and, short of the failure condition below, it does not fail.

The rejected alternative is the ceremony this replaces — a `Speichern` button plus a
timestamped `Gespeichert 14:32` Quittung beside every editable field. It doubled the
control count on the busiest screen and asked the organizer to confirm, 25 times per
session, something that is true by construction.

**Creating a record keeps its commit button.** `Hinzufügen`, `Anlegen`, `Importieren`:
a creation form is a draft until submitted, and a half-typed name must not become a
Person. The distinction is *new record* versus *edit of an existing one*, not *important*
versus *unimportant*.

**Toasts remain rejected outright**, as does any transient success message. They overlay
content, need a z-index and portal system this design has deliberately avoided, and time
out.

### Effects the organizer cannot see use the frame line

The one thing still reported on success: a write whose **result is off-screen**. The app
frame's status line is its home, and it states facts, not saves. This is where **cascade
counts** land, because the affected records are by definition not on the screen:

```
Löschung: Anna Meier und 3 Teilnahmen entfernt
Rollen kopiert: 4 übernommen, 2 bereits vorhanden
```

The CSV download reports here too — row count and filename — since the app's primary
output is silent today.

### The write contract

Writes are **persist-then-mutate**: `putRecord` resolves *before* the in-memory Library
changes, so a failure touches nothing and the invariant is *what you see is stored*. This
reorders `library.svelte.ts`.

Cascades go through a **transactional `writeBatch({ puts, deletes })`** so a half-applied
Löschung is impossible. Five operations need it: role copy, role removal, field removal,
Erasure, and the import commit — each of which is currently a loop of independent
transactions.

> **Build note.** This is a change below the UI, in `src/lib/library.svelte.ts` and
> `src/lib/store/library-db.ts`. `deleteRecords` is already transactional; `putRecord` is
> one record per implicit transaction and there is no multi-put API.

### The frame banner — two severities, one slot

> **Revised 2026-08-13** by *Decide the service-worker update UX*. This was a failure
> banner; it is now the frame's slot for **standing conditions**, of which there are
> exactly two.

| Severity | Condition | Text | Action |
|---|---|---|---|
| **`--danger`** | this session is failing to save | `Speicher nicht verfügbar — Änderungen werden nicht gesichert` | none |
| **Neutral** | a new version is waiting | `Neue Version verfügbar` | `Neu laden` |

The neutral tone uses `--raised`, `--rule-hard`, `--ink` and `--accent`. **No new tokens**;
the set stays at 41 and `tokens.test.ts` is untouched.

**Precedence: failure outranks, and one banner is ever visible.** The version notice is
held while a write failure stands and re-shown when it clears — both are flags in the frame,
and a waiting service worker does not care how long it waits. This also keeps the frame
height stable. The counter-argument (a storage failure is sometimes exactly what a new
version fixes) was heard and rejected: the organizer cannot know that, and the app must not
imply a reload is a remedy.

#### Failure

A failed write is a **session-wide condition** — quota exceeded, storage evicted,
private-browsing, db force-closed. Once one write fails the next will too. It is therefore
reported **once, in one place**, naming the cause.

Raised by the **first** failure, cleared by the next success. It does **not** stack, and
there is **no per-control failure mark** — that would be the Quittung slot returning
through the back door, present on every editable field for a condition that is rare and
session-wide. Under persist-then-mutate the failed edit visibly snaps back; the banner is
what explains why.

**No automatic retry** — retry against a quota error is futile and hides the condition.
**No read-only lock** — a failing store is exactly when the organizer is mid-event and
needs to read the Teilnehmer list.

#### A waiting version

The service worker registers with `registerType: 'prompt'`, so **no reload ever happens
without the organizer asking for it** and the old precache stays whole while they defer.
The notice qualifies for this slot because it is a standing condition — true until acted on.
The frame status line was rejected for it: that line is transient and reports facts about a
write that just happened.

`Neu laden` raises the §7 Confirm dialog **only when uncommitted work exists**; otherwise it
reloads directly. Checking for updates happens **on load only** — no timer, no visibility
hook. Both remaining callbacks are silent: `onOfflineReady` says nothing (§0.1 bans
transient success messages, and this one announces something the organizer never asked
about and cannot act on), and `onRegisterError` logs to the console only (registration can
fail outright on an exact-files-only host, but the app still works — only offline capability
is missing, and a `--danger` banner would claim data is at risk when none is).

The consequence, stated deliberately: **nothing in the UI ever tells the organizer whether
the app is offline-capable.**

---

## 4. Forms and inputs

- **Labels always above the input**, in the label bundle (§8). A placeholder is never a
  label.
- **Inline edit forms carry a visually-hidden label** (`.vh`), not a visible one — the row
  already names the thing, and a label above an input inside a 36px row wrecks the density.
- **Mark optional, not required.** Nearly everything in AMTS is required; Notiz and custom
  values are the exceptions, and marking the rare case is quieter than starring the common
  one. No bare `*` anywhere.
- **Placeholders carry format examples only** — never the label, never requiredness.
- **Two select-placeholder kinds, and the difference carries information:**
  a **disabled** `… wählen` where a choice is mandatory, a **selectable** `– kein –` where
  empty is legal.

### Validation is on submit

**Submit buttons are never disabled for validity.** A `disabled` button is removed from the
tab order, so a keyboard or screen-reader user tabs from the input straight past the submit
and is never told why the form will not go — which is what happens at five sites today.

On submit:

1. the first invalid control takes focus;
2. its message renders adjacent in `--danger`, wired with `aria-invalid="true"` and
   `aria-describedby`;
3. the message clears on the next input to that control.

### Uniqueness: an asymmetry that is correct

Rollen, Custom Fields, Import-Zuordnungen and Export-Ansichten check name collisions
(`… bereits vergeben.`); Veranstaltungen and Personen do not. **This is deliberate and
must not be "fixed".** The first four are *named references* within a scope, where a
duplicate name is ambiguous. Persons and Events are *records* — two real people sharing a
name is exactly the fact ADR-0001's fuzzy import matching exists to handle, and forbidding
it would be a domain error.

---

## 5. Inline editing

One implementation owning a single `openEditor` state for the whole app — which makes six
parallel implementations structurally impossible rather than asking reviewers to notice.
Focus moves programmatically on open and **returns to the trigger on close**, so the
`autofocus` attribute and its six `svelte-ignore a11y_autofocus` suppressions disappear.

### Three weights

| Weight | Mechanism | Sites |
|---|---|---|
| No mode at all | the input **is** the display; persists on change | custom values, Rollen toggles, **inside the detail row** (§6) |
| Single field | **in-row swap** — row content → input; **no buttons** | rename Veranstaltung, Rolle, Person, Ansicht, Zuordnung |
| Multi-field or long text | **expanded detail row** on `--inset`; **no buttons** | Notiz, Custom Field edit |

### Keys and commit points

- A `<select>`, checkbox or toggle persists **on change**.
- A text field persists on **blur** and on **`Enter`**; in a textarea `Enter` is a newline
  and **blur** is the commit.
- **`Escape` reverts the field to its stored value and closes the editor.** It is the only
  way to abandon an edit, and it works because the draft has not been written yet — the
  field is uncommitted until it blurs.

### One editor at a time — and no prompt

Opening another editor **commits the current one and closes it**. There is no dirty state
that outlives a blur, so there is no Discard dialog and no prompt.

> **Revised 2026-08-11.** The original conventions rejected auto-save-on-close, on the
> argument that it silently commits an abandoned edit. That is now the accepted behaviour:
> the ceremony of a `Speichern` button and a discard prompt on every field costs more, all
> session long, than the rare abandoned rename costs once — and `Escape` still abandons it
> deliberately.

---

## 6. Lists and tables

**Any list carrying more than one column of data is a real `<table>`** with
`<th scope="col">`. `<ul>` is reserved for genuinely single-column lists. The direction is
a register; the register needs columns.

| Aspect | Convention |
|---|---|
| Row height | `--row` (36px) |
| Separation | `--rule` hairlines. **No zebra** |
| Header | `--raised`, sticky at `top: var(--frame-h)` |
| Alignment | text left; counts and numerics right; codes in `--font-code` with `--track-code` |
| Row actions | icon-only, `opacity: 0`, revealed on `tr:hover`, `tr:focus-within`, `tr.open` |
| Coarse pointers | row actions are **always visible** under `@media (pointer: coarse)` |
| Expansion | a second `<tr>` with `<td colspan>`, ground `--inset`, `aria-expanded` on the trigger |

**No zebra** is not a taste call: a stripe would be a **fifth ground token**, and every ink
token would then have to clear 4.5:1 against it in both themes. The token set caps the
matrix at six grounds and deleted `--ink-faint` to keep it passing.

**Cells contain text, not controls.** Editing a value happens in the expanded `--inset`
detail row. Live inputs in cells would mean ~1,350 controls at 9 columns × 150 rows — a
wall of boxes that contradicts the direction, and, in the borderless variant, ~1,350 tab
stops.

Row actions use `opacity`, **never `visibility: hidden`**, which removes an element from
the tab order entirely.

### One named exception: the single primary action of a row may stay visible

> **Added 2026-08-12** by *Design the export view screen*.

`Herunterladen` in the Export-Ansichten register is a visible Secondary button in the row.
The download is the purpose of that screen and the act the organizer came for; hiding the
one thing the screen exists for behind a hover reveal is not density, it is concealment.

The exception is stated as **the single primary action of a row**, not as a free-for-all.
Every other action in that same row (`Bearbeiten`, `Duplizieren`, `Übernehmen`, `Entfernen`)
stays icon-only and hover-revealed, and no other register currently qualifies.

---

## 7. Dialogs

Native `<dialog>` + `showModal()`. Top layer, so no z-index scale is needed; focus trap and
`Escape` come free. No library.

**A dialog is for a decision that blocks work — confirmations and discard prompts. Never
routine data entry.** A modal costs the organizer their scroll position and context, which
an offline single-user tool doing bulk entry cannot afford.

### Two kinds, one grammar

| Kind | Body | Buttons |
|---|---|---|
| **Confirm** | title + the cascade sentence for that action | `Abbrechen` · `Entfernen` |
| **Type-to-confirm** | same + `Zur Bestätigung den Namen eingeben` | `Abbrechen` · `Löschung` |

This collapses the app's two confirmation grammars into one grammar with one extra step for
the heaviest case: Erasure's typed-name confirmation moves out of the page and into the
dialog, and the five `window.confirm` call sites become the same component.

### The instances

| Raised by | Kind | Sentence |
|---|---|---|
| Teilnehmer entfernen | Confirm | the Teilnehmer's cascade |
| Rolle / Custom Field entfernen | Confirm | the values that go with it |
| Veranstaltung entfernen | Confirm | the Teilnehmer that go with it |
| Export-Ansicht entfernen | Confirm | — |
| **Löschung einer Person** | Type-to-confirm | the affected Veranstaltungen **by name**, then `Anders als beim Entfernen eines Teilnehmers bleibt nichts erhalten.` |
| **`Neu laden`** with uncommitted work | Confirm | `42 entschiedene Zeilen der Import-Prüfung gehen verloren.` — buttons `Abbrechen` · `Neu laden` |

**Every dialog in the app is destructive.** The Discard dialog was the one exception and it
is gone with the dirty state that raised it (§5) — nothing else interrupts the organizer.

> **The reload confirm is not the Discard dialog returning.** Added 2026-08-13 by *Decide
> the service-worker update UX*. The Discard dialog died because no dirty state existed to
> protect: edits persist on blur. Here it demonstrably does — the Import review holds the
> parsed table, the column-mapping draft and every row decision in component `$state`, and
> the `File` **cannot be re-read after a reload**. Discarding a review is destructive, so
> the invariant holds. **One flag, and the Import route is its only setter**: creation forms
> and the Export-Ansicht editor are re-typeable in seconds and do not earn it.

- **The confirm button is Secondary + `--danger` border.** Inside a dialog the confirm is
  the focal action and a Quiet text button is too weak; no ambiguity results, because the
  dialog states the cascade in words.
- **Default focus lands on `Abbrechen`**, never the destructive button.
- The backdrop is `--scrim`. It is the only separation cue available, since this direction
  has no shadows.

---

## 8. Sections and grouping

### Headings

**The wordmark is not a heading.** `<h1>` is the page title — the route, or the
Veranstaltung's name. Sections are `<h2>`. **Cap at `<h3>`, and a component never picks its
own level**: `CustomFieldManager`, `ExportViewManager` and `ExportFilterEditor` are always
sections, so they render `<h2>` and stop nesting.

### The label bundle

The direction's signature, defined once as a class rather than as five token names:

```css
.label {
  font-size: var(--text-label);
  letter-spacing: var(--track-label);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--ink-mute);
}
```

Used for field labels, column heads, and section headings. Small type on an `<h2>` is
deliberate — it puts structure in a different voice from content.

### The Blatt

One container primitive: `--surface` ground, 1px `--rule-hard`, `--radius`, capped at
`--sheet-max`. **Never nested** — there is no card-in-card. Sections *within* a Blatt are
separated by a `--rule` hairline, not by another box.

### Collapsing

Native `<details>` / `<summary>` with a `chevron-right` / `chevron-down` marker. Allowed
only where **all three** hold:

1. the section is long enough to push the screen's purpose out of view;
2. it is **not** that purpose (Einrichtung beside a Teilnehmer list — never the list);
3. **the collapsed state is not persisted.**

Condition 3 follows from the map's scope: any stored user preference other than the theme
is out. Collapse state is per-visit, in memory, reset on navigation.

This is a different mechanism from the row expansion in §6, which is a `<tr>` on `--inset`.

---

## 9. Empty states

Two tiers, distinguished by cause, because they mean opposite things.

| Tier | Cause | Says | Renders as |
|---|---|---|---|
| **Nothing yet** | no records exist | `Noch keine Veranstaltungen.` + the primary action | **replaces the whole table, `<thead>` included** |
| **No matches** | a search or filter excluded everything | `Keine Treffer für „…“` + `Filter zurücksetzen` | **keeps `<thead>`**, one `<tr><td colspan>` |

The rendering difference carries the meaning: an empty register has no columns to show,
whereas a register with nothing on *this* page still has its structure.

- **An empty state never accompanies a hidden creation path.** Its action either is the
  trigger, or focuses the form. Two screens hide the form that would fix their emptiness
  today.
- **No illustrations.** `--ink-mute` prose, optional single icon, the tier-1 action as a
  Primary button.

---

## 10. Boot: loading and error

**One `BootGate` in `+layout.svelte`, not five copies.** The frame — header and sidebar
chrome — renders immediately; the gate occupies only the content area.

- **Loading**: `--ink-mute` line, `Bibliothek wird geladen …`, rendered immediately. No
  spinner, no artificial delay.
- **Error**: a full content-area state in `--danger` (data at risk, per §0.2) — *not* the
  frame banner from §3, which means *your session is failing to save*. A boot failure means
  there is no app yet. It states what happened, shows the technical detail, and offers
  **`Erneut versuchen`** re-running `bootLibrary()`.

Retry is meaningful here, unlike a write failure, because a boot failure is often
transient. The one differentiated case: `openDB` **blocks when another tab holds an older
DB version**, which `idb` surfaces via its `blocked` / `blocking` callbacks —

```
Eine andere Registerkarte blockiert die Aktualisierung — bitte schließen.
```

Everything else is one generic failure plus the technical detail.

---

## 11. Token additions

The set moves from 39 to **41**. Both are theme-aware and used in more than one component,
which is what the token set's own addition rule requires.

```css
--accent-hover: light-dark(#0c4559, #8bcbe2);   /* Primary button hover */
--scrim:        light-dark(#14181b6b, #0507089e); /* ::backdrop */
```

Verified: `--on-accent` on `--accent-hover` is **10.08** light and **9.37** dark. The step
from `--accent` is 1.25 / 1.19 — visible but calm. Each theme moves *away* from its ground
(light darkens, dark lightens), which is the behaviour `filter: brightness()` cannot
guarantee.

**Classification for `tokens.test.ts`**, which fails closed on an unclassified token:

- `--accent-hover` is **not** a matrix ground. It follows the precedent already set by
  `--accent`: one explicit pair, `--on-accent` on `--accent-hover`. Adding it to `GROUNDS`
  would widen the universal-AA matrix to seven and is not intended.
- `--scrim` is **`DECORATIVE`** — a translucent overlay with no contrast floor.

> **Build note.** `--scrim` is written as **8-digit hex** rather than `rgb(… / …)` so the
> test's `light-dark(a, b)` regex stays hex-only.

---

## 12. Accessibility checklist per convention

Every convention above was checked against the map's rules. The non-obvious outcomes:

| Rule | Where it bites |
|---|---|
| Keyboard path | `visibility: hidden` row actions are unreachable → `opacity` (§6). Disabled submits are unreachable → on-submit validation (§4) |
| Focus visibility | declared once globally; components never restate it. Inline editors return focus to the trigger (§5) |
| Associated labels | every inline editor and note textarea gets a `.vh` label; validation messages are wired with `aria-describedby` (§4) |
| Contrast | the two new tokens are verified above and classified in `tokens.test.ts` (§11) |
| No colour-only meaning | severity is carried by the **word** (`Entfernen` vs `Löschung`) before it is carried by `--danger` (§1); the failure banner names the cause in a sentence, not by ink alone (§3); an open row carries `aria-expanded` and a detail row, not just `--selected` (§6) |
| Announcements | the frame status line is the app's only `aria-live="polite"` region (§3). Nothing else announces, because nothing else reports success |

**Left unautomated, by earlier decision:** visible focus is a manual review item, and glyph
divergence rests on review against the Aktionsvokabular (§2).

---

## 13. Tastatur und Fokus

Settled 2026-08-13 in `.scratch/ui-design/0016-keyboard-scheme.md`. **Almost nothing beyond
native** — and the one measured win is bought with native semantics rather than a shortcut.

### No global shortcuts, and the absence is the rule

**No chord reaches the sidebar, no hotkey focuses the Teilnehmer search, no go-to-section
keys.** An organizer who is here a few times a year will not learn a key they are never
told about, and telling them costs a surface the app then has to maintain. Stated
explicitly so no screen invents its own.

Anything added is added **only where repetition inside a single sitting teaches it** —
which in this app means the Import review, and nothing else.

### Registers are documents, not grids

**No `role="grid"`, no roving `tabindex`, no APG Data Grid pattern anywhere.** All four
registers keep the plain `<table>` semantics of §6. The grid pattern would make the register
answer to a different interaction model than the document around it (a screen reader
switches modes on entry), and it would have to apply to every register or the app carries
two table grammars.

On top of that sits an **additive layer**: with focus already inside a row, `ArrowUp` /
`ArrowDown` move to the *corresponding* control one row up or down. `Enter` on the row
trigger expands the detail row — already native, since the trigger is a `<button>`.

> **The layer is additive by construction, and that is the whole safety argument.** With a
> screen reader running, browse mode swallows arrows before the page sees them, so the layer
> silently does not exist for AT users. Tolerable *only* because nothing depends on it. It
> must **never** become the sole way to reach anything.

One implementation, shared by all four registers.

### `Escape` — one ladder, one rung per press

The key has exactly one meaning, applied to the innermost open thing:

1. an **uncommitted field** reverts to its stored value (and closes the editor, where there
   is an editor mode — §5);
2. otherwise the **expanded detail row** closes and focus returns to its trigger;
3. a **modal dialog** always takes the key first, natively (§7).

It **never navigates** — no Escape-to-go-back on any screen — and it **never clears a
filter**. The precedence order is needed because inside a detail row §5 gives the fields no
editor mode at all (the input *is* the display), so "revert the field" and "close the row"
would otherwise both claim the key in the same place.

This is **one shared behaviour, not per-screen handlers**: it belongs with `openEditor`
(§5), which already owns the app's single editor state.

Consequence for search inputs: **`type="text"`, never `type="search"`.** Chrome clears
`type="search"` on `Escape` and other engines do not — a fourth meaning arriving by
accident, inconsistently.

### One decision, one tab stop

Where a row carries a one-of-N decision, it is **one radio group**, not N toggle buttons.
The Import review is the case: three `<button aria-pressed>` per row become
`Offen · Verknüpfen · Neu anlegen · Überspringen` as four radios in one group, styled as the
same segmented control. **450 → 150 tab stops.** Arrows choose within the group natively,
one decision stops announcing itself as three independent toggles, and `Offen` becomes a
visible state instead of an implicit absence.

**Each group needs its own accessible name** — `Entscheidung für Zeile 12 · Maria Schmitt`.
The `<th>` alone cannot distinguish 150 identical groups, and this is the defect axe-core
exists in this project to catch (see
[`design-direction.md` §6](./design-direction.md#three-checking-layers)).

### Skip links — one component, five places

Visually hidden, revealed on focus.

| Link | Where | Target |
|---|---|---|
| `Zum Inhalt` | the **first focusable element of the frame**, on every screen | `<main>` |
| `Register überspringen` | immediately before each of the four registers | the element *after* the table |

The frame link is paid on every arrival on every screen — ~8–10 sidebar stops otherwise. The
register links answer the one case the arrow layer cannot: arrows move *within* the table,
and the Import screen's sticky foot carrying `Import ausführen` is visually always on screen
but sits after ~150 stops in source order. Plain HTML anchors, zero JS.

They come with `header` / `nav` / `main` landmarks. Landmarks **alone** were rejected: they
do nothing for a sighted keyboard-only organizer.

### Nothing is advertised

**No `?` overlay, no Tastatur screen, no inline hints, no help section.** Everything above is
native (radio arrows, dialogs, tab), self-revealing (both skip links appear the moment they
are focused), or free to miss (the arrow layer costs a keyboard user only the tab presses
they were already making). The scheme is documented for whoever **builds** it; the app
itself says nothing.

---

## 14. Handed to the build

Everything this document decided that is a change *below* the UI, collected for
`.scratch/ui-restyle/`:

- **persist-then-mutate** and the transactional `writeBatch({ puts, deletes })` for the five
  cascades (§3) — a reorder of `src/lib/library.svelte.ts` and `src/lib/store/library-db.ts`.
- **No Quittung component is built at all.** One frame status line and one frame banner
  cover every report the app makes.
- `Veranstaltung löschen` → **`Veranstaltung entfernen …`** (§0.3): `src/routes/+page.svelte`
  is a live violation of the `Lösch-` reservation.
- The two token additions and their classification entries (§11).
- `<h1>` moves off the wordmark (§8).
- **`renamePerson` does not exist in the domain layer at all** (§5 lists renaming a Person
  as a single-field in-row swap).
