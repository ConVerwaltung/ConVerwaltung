# Screens

The information architecture, route by route: what the frame holds, what each screen shows,
how editing works on it, and what it does when there is nothing to show or something goes
wrong.

Assembled from `.scratch/ui-design/` — the navigation model (`0006`), the four screen
designs (`0010`–`0013`), the keyboard scheme (`0016`), the routing research (`0015`) and the
service-worker UX (`0017`). Every design here was chosen against a prototype rendered with
real data at 1280px.

Companion documents: [`design-direction.md`](./design-direction.md) — the visual direction,
type, palette and accessibility rules — and [`component-conventions.md`](./component-conventions.md)
— the shared vocabulary. Section references below (§3, §6, §7 …) are into the conventions.

Domain terms come from [`CONTEXT.md`](../../CONTEXT.md) and appear verbatim in UI text.

---

## The route table

```
/                                    Veranstaltungen — the overview, and where the app always lands
/event/<id>                          → redirects to /event/<id>/teilnehmer
/event/<id>/teilnehmer               the daily driver
/event/<id>/einrichtung              Rollen, Teilnehmer-Felder, the Veranstaltung itself
/event/<id>/import                   the Import review — a place, leavable and returnable
/event/<id>/export                   Export-Ansichten at Teilnehmer level (the register)
/event/<id>/export/<viewId>          the Ansicht editor
/person/<id>                         one Person: global data, Notiz, Teilnahmen, Löschung
/stammdaten                          the Personen-Pool, and nothing else
/stammdaten/einrichtung              Person-Felder · Import-Zuordnungen · Export-Ansichten
/stammdaten/einrichtung/<viewId>     the Ansicht editor, Person level
```

This replaces today's `?id=<uuid>` query addressing. **Each route gets its own `<title>`**;
today it is the constant `AMTS`.

**Three dynamic subtrees** — `event/[id]`, `person/[id]`, and the two `<viewId>` editors
beneath them — are served by a prerendered SPA fallback (`200.html`) rather than being
prerendered, because their ids are runtime data and cannot be enumerated. Static routes
stay prerendered. See [ADR-0008](../adr/0008-svelte-vite-typescript-stack.md) and the build
backlog for the configuration.

---

## The frame

An app header plus a **persistent left sidebar, on every screen without exception**. It was
chosen for *orientation*: it says where you are and what else exists — which the app has
none of today.

```
┌────────────────────────────────────────────────────────────────────┐
│ AMTS          Skaven / Mövennest › Teilnehmer            ☼ Thema   │ --frame-h
├──────────────┬─────────────────────────────────────────────────────┤
│ SKAVEN /     │                                                     │
│ MÖVENNEST    │                                                     │
│  Teilnehmer  │                    <main>                           │
│         120  │                                                     │
│  Einrichtung │                                                     │
│  Import      │                                                     │
│  Export      │                                                     │
│              │                                                     │
│ ─────────────│                                                     │
│  Alle        │                                                     │
│  Veranstalt. │                                                     │
│  Stammdaten  │                                                     │
│    Personen  │                                                     │
│    Einricht. │                                                     │
└──────────────┴─────────────────────────────────────────────────────┘
```

| Part | Contents |
|---|---|
| **Header** | the `AMTS` wordmark, linking to `/`; a breadcrumb naming the current place; the theme control on the right |
| **Sidebar, upper group** | the open Veranstaltung, its name as the group heading, then **Teilnehmer** (with a count) · **Einrichtung** · **Import** · **Export** |
| **Sidebar, lower group** | the way out: **Alle Veranstaltungen** · **Stammdaten**, the latter with two sub-entries (**Personen**, **Einrichtung**) |

- The sidebar keeps showing the **last-opened Veranstaltung** even on the Übersicht and in
  Stammdaten, so returning to work is one click. **Switching Veranstaltung goes through
  *Alle Veranstaltungen*** — there is no Event switcher in the frame, because a working
  session is one Veranstaltung.
- The current place is marked in the sidebar **and** named in the breadcrumb — two signals,
  neither colour-only.
- The count on Teilnehmer means the sidebar **reads the Library**: it is a component with
  data, not static markup.
- **The wordmark is not the `<h1>`** (§8). `<h1>` is the page title — the route, or the
  Veranstaltung's name.

### What else the frame owns

| Element | Behaviour |
|---|---|
| **`Zum Inhalt`** | the first focusable element on every screen, jumping past the sidebar to `<main>` (§13) |
| **Landmarks** | `header` / `nav` / `main` |
| **The banner** | one slot, two severities, failure outranks (§3) |
| **The status line** | the app's only `aria-live="polite"` region; facts about effects the organizer cannot see (§3) |
| **`BootGate`** | one instance, in `+layout.svelte` — the chrome renders immediately, the gate occupies only the content area (§10) |
| **`hasUncommittedWork`** | one flag, set by the Import route alone, read by the reload confirm (§7) |
| **The single `openEditor` state** | one editor open in the whole app at a time; owns the `Escape` ladder (§5, §13) |

### Boot

- **Loading**: `Bibliothek wird geladen …` in `--ink-mute`, rendered immediately. No spinner,
  no artificial delay.
- **Error**: a full content-area state in `--danger` — *not* the frame banner, which means
  *your session is failing to save*. A boot failure means there is no app yet. It states what
  happened, shows the technical detail, and offers **`Erneut versuchen`** re-running
  `bootLibrary()`. Retry is meaningful here because a boot failure is often transient.
- One differentiated case: `openDB` **blocks when another tab holds an older DB version** —
  `Eine andere Registerkarte blockiert die Aktualisierung — bitte schließen.`

### First run — the empty Library

- **The sidebar's Veranstaltung group stays**, reading `Noch keine geöffnet.` The structure
  is visible before it is filled; a sidebar that grows a group later would hide what the app
  is.
- The app **always lands on `/`**. Opening the last Veranstaltung would need a stored
  preference, which is out of scope.

---

## `/` — Veranstaltungen

The register of Veranstaltungen, and the entry point to everything. 10–40 accumulate over
the years.

**Columns:** `Veranstaltung · Teilnehmer · Rollen · Angelegt · Imp.`
Sortable on Veranstaltung, Teilnehmer and Angelegt, with `aria-sort`.

- The name is a link into `/event/<id>/teilnehmer`.
- Row actions, icon-only and hover-revealed (§6): `Umbenennen` (`pencil`),
  `Veranstaltung entfernen …` (`trash-2`).
- A Primary **`Veranstaltung anlegen`** opens the inline `--inset` creation form above the
  register — not a dialog (§7). Creation keeps its commit button (§3).
- 18 rows cost 54 tab stops.

### `Angelegt`, and the thing it cannot say

**No Veranstaltungsdatum exists and none is introduced.** ADR-0002 gives an Event a `name`
and nothing else; a date would be new stored data, which is out of scope. `Angelegt` is the
**UUID v7 timestamp already inside the record id**, decoded by a `creationTimeOf(id)` helper
beside `compareByCreation`.

**Flat register, newest first. Year bands are rejected.** Two reasons: bands and sortable
columns contradict each other (sort by Teilnehmer and the bands become noise), and a band
labelled `2025` would assert the *creation* year as the event's year. A column reading
`23. Jan. 2025` states a fact; a band states a claim the data does not support.

> ***Which Veranstaltungen are still live* is therefore answered by order alone**, which is
> honest at 10–40. Anyone reading this screen later will assume a date field was forgotten —
> it was not.

### States

- **Nothing yet** (tier 1, §9): `Noch keine Veranstaltungen.` + one sentence of cause + the
  Primary action. Replaces the whole table, `<thead>` included.
- **No matches** (tier 2): keeps `<thead>`, one `<tr><td colspan>`.

---

## `/event/<id>/teilnehmer` — the daily driver

**One surface.** The register runs the full content width at ~9 columns; everything about
one Teilnehmer opens in place in the `--inset` detail row and closes again. The accepted
cost is that the grid reflows on open and the reading position moves.

Chosen against a docked inspector and a Rollen matrix, prototyped at 120 Teilnehmer.

### Row anatomy

```
Nr. │ Person             │ Vermerk │ Crew    │ Verpfleg. │ LARP-Erf. ⊕ │  Betrag │ Notiz │
 12 │ Maria Schmitt      │ SC NSC  │ Küche   │ vegetarisch│ ja          │  45,00 │  ▤    │  ✎ 🗑
    │ „Alrik vom Berg"   │         │         │            │             │        │       │
```

| Element | Treatment |
|---|---|
| `Nr.` | row index, `--text-xs` |
| **Person** | the name, **a link to `/person/<id>`**; Charaktername beneath in `--ink-mute` |
| **Vermerk** | the Rollen as fixed-width codes in `--font-code`, primary bold and underscored, further roles in `--ink-mute` — the direction's signature |
| Custom-Field columns | plain text. Person-level columns carry the `globe` icon **in the head** |
| `Betrag` | right-aligned, `--font-code`, tabular figures |
| **Notiz** | a `message-square-text` **marker**, never an excerpt |
| Row actions | icon-only, `opacity: 0` until `tr:hover` / `tr:focus-within` / `tr.open`: `pencil`/`chevron-down` to open, `trash-2` to remove |

**Everything but the name is text** (§6). ~360 row tab stops at 120 rows.

**Notiz is a marker, not an Auszug.** Two clamped lines of the actual Notiz were prototyped
and are the more useful row — and they put allergies and health statements permanently on a
screen other people can see. The Notiz is read in the detail row, one deliberate act away.

**Scope is marked by the rare case.** A `globe` in the column head and again in the detail
row, with a legend under the table; Teilnehmer-level fields carry nothing. This replaces
today's two fieldsets labelled *veranstaltungsübergreifend* and *nur diese Veranstaltung*.

### The detail row

A second `<tr>` with `<td colspan>`, ground `--inset`, `aria-expanded` on the trigger. It
holds, in a `1fr 22rem` grid:

- the **Rollen as toggles**, each persisting on change;
- the Teilnehmer-Felder and the Person-Felder (the latter marked `globe`), each input **being
  the display** — no editor mode at all (§5);
- the **Notiz** as a textarea, committing on blur;
- an explicit **`Person öffnen`** line, so the departure to `/person/<id>` is a stated act
  rather than a name that silently leaves the Veranstaltung.

### Why the Rollen codes survive editing

A matrix of one column per Rolle was prototyped and rejected on three counts, in order of
weight:

1. **840 controls in the grid** at 120 × 7 — exactly what §6 forbids.
2. **The column count is bounded by the Rollen count, and nothing in the domain bounds
   that.** Seven fit; twelve do not, and the screen would degrade with no warning.
3. Reading coverage down a column (*wer ist Sani?*) is real, but it is what the **Rollen
   filter** already answers, in one click, without a column per Rolle.

### Finding one among 120

Client-side only, nothing persisted:

- a **search field** over Name, Crew and Charaktername — `type="text"`, never
  `type="search"` (§13);
- **Rollen filter chips**;
- **sortable column heads** on Person, Crew, Verpflegung and Betrag, with `aria-sort`;
- a count reading `47 von 120 Teilnehmern`;
- **sticky `thead`** at `top: var(--frame-h)`;
- a `Register überspringen` skip link before the table (§13).

This is what the direction demanded when it rejected the people-first variant on
findability: at 36px rows, scanning and sorting carry the load and **search stays an
affordance**.

### Adding a Teilnehmer — three paths collapse into one

Today: a form for a new Person, and two chained selects for an existing one. Instead **one
Primary `Teilnehmer hinzufügen`** opens an inline `--inset` form above the register (not a
dialog — §7), with **one Person field**: a text input over a list of known Personen.
Selecting an entry reuses that Person; typing an unknown name creates one.

> **Reuse must require an explicit selection, never a name-equality guess.** Two people
> sharing a name is the fact ADR-0001 exists to handle.

**Import stays a place in the sidebar**, not a third add-path in this toolbar. **Rollen and
Teilnehmer-Felder are not on this screen** — they live in Einrichtung, which is what that
section is for.

### States

- **Nothing yet** (tier 1): the Veranstaltung has no Teilnehmer — one sentence, the Primary
  `Teilnehmer hinzufügen`.
- **No matches** (tier 2): keeps `<thead>`, offers `Filter zurücksetzen`.

### `/event/<id>` with no section

**Redirects to `/event/<id>/teilnehmer`.** The Veranstaltung has one daily purpose and the
sidebar already names the four sections; an index screen would be a fifth screen to design
and a click-through on every visit.

---

## `/event/<id>/einrichtung` — the rare half

The Veranstaltung splits into **Teilnehmer** (daily) and **Einrichtung** (rare). This screen
holds the **Rollen**, the **Teilnehmer-Felder**, and the Veranstaltung's own rename and
removal. It exists so the five stacked add-forms come off the participant screen without
inventing a new pattern for them.

It follows the same shape as [`/stammdaten/einrichtung`](#stammdateneinrichtung--the-rare-half-of-the-pool):
a stack of section managers, each a Blatt (§8), each with its own tier-1 empty state.
`CustomFieldManager` renders `<h2>` and stops nesting (§8).

- **Rollen** — name, and the Rollen-Kopie from a previous Veranstaltung. The copy reports to
  the frame status line, because most of what it did is off-screen:
  `Rollen kopiert: 4 übernommen, 2 bereits vorhanden` (§3).
- **Teilnehmer-Felder** — the per-Veranstaltung Custom Field definitions.
- Removing either raises the §7 Confirm dialog with the cascade sentence, and the cascade
  goes through `writeBatch` (§3).

---

## `/event/<id>/import` — the review

The hardest flow in the app. ADR-0001 makes Import an interactive fuzzy review: parse →
propose name-similarity candidates → the organizer confirms **per row** → commit. It cannot
run headless, and a wrong confirmation silently merges two different people.

Measured against a **142-Person pool and a 150-row file**, running the shipping matcher.

### There are no stages

**The file *is* the register**: one table, mapped in the head, decided in the leftmost
columns, committed from a sticky foot. The organizer never navigates between *the mapping*
and *the review* because they are the same surface — and **the evidence for a decision sits
in the same row as the decision**.

A four-step wizard was rejected for putting the Zuordnung off-screen exactly when the review
raises a question about it (*"which column was Verpflegung again?"*). A one-page accordion
was rejected because nothing makes the organizer look at the Zuordnung before scrolling past
it, and its commit block ends up below 147 rows.

### The width, and how it is paid

The register carries the five review columns plus **only the mapped file columns** — ~8,
which fit 1280px without horizontal scrolling. A quiet **`Alle 17 Spalten zeigen`** brings
the ignored ones back for the moment a mapping is in doubt.

The **identity columns are folded into `Name in der Datei`**, whose head carries the chain
(`aus Vorname + Nachname`) and their selects; otherwise Vorname and Nachname would be
printed twice in every row. `Zeile` and `Name` are **sticky columns**, because the toggle can
put the table back over the fold at any time.

Each `<th>` of a mapped column carries the `<select>` that maps it — that is the Zuordnung,
in place.

### Judging a match

| Element | Treatment |
|---|---|
| **Similarity** | a **word before a number**: `Sicher` · `Ähnlich` · `Schwach` · `Mehrdeutig` · `Kein Vorschlag`, with the percentage as a muted second reading. **A bare score is never shown.** |
| **The differing name part** | underlined (wavy, `--rule-hard`) in both the file name and the proposal — never colour alone |
| **Vorschlag** | the candidate Person |
| **Beleg** | prefers the exception: a duplicate row in the file, or *„3 gleichnamige Personen"*; otherwise the candidate's provenance (`2 Veranstaltungen · zuletzt … ·` Notiz marker) |

The **detail row on `--inset` is the evidence**: every candidate with its Veranstaltungen,
Notiz marker and Person-Felder; the file's values against the stored ones; and a **search
field for a Person the matcher did not propose** — which 11 rows in the sample need.

**Filter chips** over the register: `Alle · Offen · Ohne Vorschlag · Mehrdeutig · Doppelt in
der Datei · Verknüpft · Neu`, plus a search over both names.

### The decision, and the guard

**One radio group of four per row**, styled as a segmented control:

```
( ) Offen   ( ) Verknüpfen   ( ) Neu anlegen   ( ) Überspringen
```

- **One tab stop per row: 150, not 450.** Arrows choose within the group natively.
- Each group carries **its own accessible name** — `Entscheidung für Zeile 12 · Maria
  Schmitt`. The `<th>` alone cannot distinguish 150 identical groups.
- `Offen` is the **absence** of an `ImportDecision`, made visible. It adds no stored data;
  the running counter already tracks it.
- `Verknüpfen` keeps its binding to the currently selected candidate.

Two rules make the fast path safe:

1. **Nothing is decided by the machine — Sammelaktion, not Vorauswahl.** No row arrives
   pre-selected. The screen offers two explicit bulk acts instead, each reversible until the
   commit: `74 sichere Verknüpfungen übernehmen` and `43 Zeilen ohne Vorschlag als neue
   Person anlegen`. **The count in the button label is the warning**, and performing the act
   is the organizer's. Vorauswahl was prototyped and rejected: it saves one click and buys
   the risk that a wrong pre-selection is committed unread.
2. **A row without a candidate is never defaulted to `Neu anlegen`** — which is what the app
   does today. *No similar name* is precisely where a duplicate Person is created: in the
   sample, 5 rows carry only an initial and 6 a changed surname, all 11 below the threshold,
   **all 11 people the Library already knows**.

*Sicher* is defined tightly: the best candidate normalises to the same name **and** no second
candidate is within 5 points. The 3 ambiguous namesakes are excluded by that rule and stay
open — they are the case a wrong confirmation silently merges two people.

> Measured over the sample: 147 reviewable rows — **74 sicher, 43 without a candidate, 3
> mehrdeutig, 4 duplicate rows** — leaving **~30 rows of real judgement** after both bulk
> acts.

### Commit

A **sticky foot** carries the running tally (`offen · neue Personen · verknüpft ·
übersprungen`) and the Primary **`Import ausführen`**. It is a creation, so it keeps its
commit button (§3) — and it is **not a dialog**: every dialog left in the app is destructive
(§7), and the foot states the consequence in words instead. While rows are open the button
is **not disabled** (§4): pressing it switches the filter to `Offen` and shows what is
missing. A `Register überspringen` link makes the foot reachable without passing every row.

Afterwards the **Bericht replaces the register**: counts, then the exceptions in prose —
unknown Rollen names with their row counts, values rejected by their field type, rows skipped
for want of a name. It ends in `Zu den Teilnehmern` and `Weitere Datei importieren`. The
frame status line is **not** used: the result is on screen, and that line is only for effects
the organizer cannot see (§3).

### Error paths

| Case | Treatment |
|---|---|
| **Unreadable file** | the frame `--danger` banner names the line and the remedy (*„ein Anführungszeichen ist nicht geschlossen"*); nothing below it renders |
| **No identity column** | the banner names the columns the Zuordnung expected. The review cannot exist and does not pretend to |
| **A Zuordnung whose columns the file lacks** | a `--ink-mute` advisory, **not** a banner: the import still works, those targets stay empty |
| **Duplicate rows inside one file** | not an error state but a **row-level flag**, in the Beleg column and in the detail row (*„Derselbe Name steht schon in Zeile 9"*) |

### This screen is the only setter of `hasUncommittedWork`

The parsed table, the mapping draft and all 150 row decisions live in component `$state`,
and the `File` **cannot be re-read after a reload**. That is why `Neu laden` in the frame
banner confirms first (§7) — and why nothing else in the app sets the flag.

---

## `/event/<id>/export` — the Ansichten register

**The register of Ansichten is the Export screen**, because an Ansicht is *fixed and run
often*: a handful per Veranstaltung, downloaded repeatedly. The editor is a place visited
rarely. This is the answer to *editing a saved View versus running it once* — they are
**different places**, and the frequent one is the register.

**Columns:** `Ansicht · Spalten · Filter · Treffer · Aktionen`, a real `<table>` (§6).

- **`Treffer` is live**, computed against the Library on every render, so the register says
  how big each file is before it is opened. Measured: Küchenliste 120/120, Ausweise SC
  95/120, Kinder und Betreuung 13/120, Beitrag offen **0**/120.
- `Spalten` shows the columns as static chips.
- The Ansicht name is a link into the editor; the `pencil` is the same trip.
- **`Herunterladen` stays a visible Secondary button in the row** — the §6 named exception.
  The other four actions (`Bearbeiten`, `Duplizieren`, `Übernehmen`, `Entfernen`) stay
  icon-only and hover-revealed.
- The download reports to the **frame status line** — row count and filename — because the
  file lands off-screen (§3).
- A **section note**, one sentence, states that the output is re-importable through an
  Import-Zuordnung. **Not a control**: nothing offers to build a Zuordnung from an Ansicht.
- Creating: an inline `Neue Ansicht` form takes the name, then lands in the editor with
  `Name` as the first column. A half-named Ansicht never becomes a record (§3).

### `Übernehmen` — the copy into another Veranstaltung

An `--inset` **detail row, never a dialog** (§7: a dialog is never routine data entry). It
holds the target `<select>` and, **before the click**, a report of everything that has no
counterpart there — computed against the target's real Rollen and Teilnehmer-Felder:

```
Nach Veranstaltung  [Sommerlager am Krähenmoor ▾]
WAS DORT FEHLT
⚠ Spalte „Charaktername" — Teilnehmer-Feld „Charaktername" gibt es dort nicht
⚠ Bedingung „Rolle SC wird gehalten" — Rolle gibt es dort nicht
                                                      [Übernehmen]
```

**The copy takes everything anyway.** Silently dropping what does not carry was rejected:
the organizer who copies *Ausweise SC* into next year's event will create the missing `Crew`
field next, and **a column that quietly vanished is one they must notice and rebuild**. A
column without a counterpart exports empty, exactly as `unresolvedColumnNames` already
handles a deleted field; a condition without one is dropped.

The commit reports to the frame line, because the result lands in another Veranstaltung:
`„Küchenliste" nach „Sommerlager am Krähenmoor" übernommen — 2 ohne Entsprechung`.

**The matching is by name**, because ids are per-Veranstaltung. That is a domain gap — see
the build backlog.

---

## `/event/<id>/export/<viewId>` — the Ansicht editor

**One shape serving both levels.** The level is **not a choice at all**: it is fixed by the
place the Ansicht was created in (`/event/<id>/export` = Teilnehmer,
`/stammdaten/einrichtung` = Personen). At Person level the Teilnehmer group of sources and
the Rollen conditions are simply absent.

The Ansicht is a **form on one Blatt**; the file is the **proof underneath at full width**.

```
Küchenliste                                   [Herunterladen]
┌── FILTER ────────────────────── 95 von 120 Teilnehmern ──┐
│ Rolle SC wird gehalten                                 ✕ │
│ + Bedingung                                              │
│ ───────────────────────────────────────────────────────  │
│ SPALTEN                                        3 Spalten │
│ 1  Name          Person · Name              ⌃ ⌄ ✕        │
│ 2  Verpflegung   Teilnehmer-Feld · Verpflegung           │
│ 3  Rollen        Teilnehmer · Rollen                     │
│ + Spalte  [… wählen ▾]                                   │
└──────────────────────────────────────────────────────────┘
VORSCHAU DER DATEI      95 von 120 Teilnehmern, 3 Spalten · Küchenliste.csv
```

**Stacked, in that order.** A two-column Blatt (Filter | Spalten) would halve the height
above the preview; putting Spalten first would raise the more frequent edit. Neither was
taken: the vertical order *filter → columns → result* is **the order the file is built in**,
and one scroll is a cheaper price than splitting the definition across an axis.

Two alternatives were rejected. Making each `<th>` its own definition puts the heading
exactly above its values, but loads the table head with four controls per column and, at ten
columns, **carries the definition off-screen with the horizontal scroll** — the definition
must not move when the data does. A standing Feldregal is the only shape that answers *what
can I even export?* without opening a menu, but costs 17rem taken permanently from the
widest table in the app for a question asked twice per Ansicht and never again.

### The filter

**UND is enough.** No ODER, no groups, no expression tree — `FilterCondition[]` with
`every()` stays exactly as it is, and the builder stays a flat list of conditions, each with
its own `✕`. The question *how do several combine* is answered by **not building it**.

### The columns

Not a two-list transfer: an **ordered list of chosen columns** plus a source `<select>` —
the available fields are a menu, not a permanent panel. `⌃ ⌄ ✕` per row reorder and remove.

**Renaming an output heading** is the §5 single-field in-row swap: click the heading, no
button, `Enter`/blur commits, `Escape` reverts. **Uniqueness is checked on submit** (§4),
never by disabling the button — a repeated heading makes the file unreadable back in.

### The preview

**The whole table** — every matching row, output headings, values exactly as the file writes
them. Not a count, not five sample names. Below the Blatt, full width, `<thead>` sticky, the
same register treatment as every other table.

Three things it does that a count-plus-names preview cannot, all measured:

- **An Ansicht can match nothing.** `Beitrag offen` matches 0 of 120: the tier-2 empty state
  says so instead of downloading a header-only file.
- **A column can be empty for every match** — `Notiz Person` is filled for 15 of 120. It is
  shown as it is and **deliberately not marked**. The `leer` badge built into the prototype
  was dropped: an empty column can be intended (the field is filled later, or the Import has
  not run), and a `--danger` mark would assert an error the data does not support. **The
  preview shows what is there and asserts nothing.**
- **A cell can run 461 characters.** Cells are ellipsis-truncated at 22rem; the legend states
  that the file keeps the whole value. The preview is honest about being a view of the file,
  not the file.

The legend also states the representation — `Rollen durch Komma getrennt, Zahlen mit Punkt`
— which is what makes the output re-importable through an Import-Zuordnung.

### Editing is silent

No `Speichern` (§3). A `<select>` persists on change, a heading on blur or `Enter`, `Escape`
reverts. **An Export-Ansicht cannot be edited at all today** — the whole editor is new domain
surface. See the build backlog.

---

## `/person/<id>` — one Person

The screen a Teilnehmer's name leads to, and **the primary way the pool is reached at all**
— the organizer rarely browses it. One column at 52rem.

```
Maria Schmitt  ✎
Gilt in allen Veranstaltungen
┌── PERSON-FELDER ─────────────────────────────┐
│ LARP-Erfahrung   ja                          │
│ Volljährig       ja                          │
│ NOTIZ                                        │
│ …                                            │
└──────────────────────────────────────────────┘
┌── TEILNAHMEN ────────────────────────────────┐
│ Skaven / Mövennest        SC NSC          🗑 │
│ Sommerlager 2024          SC              🗑 │
│ Als Teilnehmer hinzufügen  [… wählen ▾]      │
└──────────────────────────────────────────────┘
Löschung …
```

| Part | Behaviour |
|---|---|
| **The name** | a `pencil` in-row rename swap (§5) — **`renamePerson` does not exist in the domain layer** |
| **The scope line** | `Gilt in allen Veranstaltungen`, stated once. The departure from the Veranstaltung was already the signal; the screen confirms it without a wall of warnings |
| **Person-Felder and Notiz** | one Blatt. The input **is** the display; persists on change, or on blur for the Notiz |
| **Teilnahmen** | one Blatt: `Veranstaltung · Rollen` (the Vermerk codes, reused), with `Teilnehmer entfernen …` (`trash-2`) per row |
| **Adding to a Veranstaltung** | one select over the Veranstaltungen the Person is **not yet** in. **This is where adding a Person to a Veranstaltung now lives** — the two chained selects at the bottom of today's `/persons` are gone |
| **`Löschung …`** | Secondary + `--danger` border — the only bordered destructive control in the app (§1) |

~14 tab stops in total.

A permanent right-hand Teilnahmen spine was prototyped and rejected. Its bet was that *where
has this person been?* is the question the screen is opened with. It is not: the way in is a
Teilnehmer's name **inside** a Veranstaltung, so the organizer already knows about one
Teilnahme and is arriving to read or fix the **global** data. The Teilnahmen belong on the
screen — they are how the pool makes sense — but as a section, not as a spine that narrows
the Notiz to 26rem and pins a list of six rows beside a field grid of two.

### Erasure

**Only on this screen.** It is irreversible and cascades across every Veranstaltung, so it
requires the departure to `/person/<id>` first — the cheapest guard available, and it takes
the red-bordered inline form out of the pool row.

- The line **above** the button states the scope in words before the dialog opens:
  `derzeit ohne Veranstaltung` / `in einer Veranstaltung` / `in N Veranstaltungen`.
- `Löschung …` opens the **type-to-confirm** dialog (§7). **The dialog names the
  Veranstaltungen rather than counting them**: the cascade sentence, then the actual list as
  static chips, then `Anders als beim Entfernen eines Teilnehmers bleibt nichts erhalten.`
- Default focus is `Abbrechen`.
- On confirm the **frame status line** reports the cascade —
  `Löschung: Anna Meier und 3 Teilnahmen entfernt` — because those records are by definition
  off-screen (§3). The cascade goes through `writeBatch`.

---

## `/stammdaten` — the Personen-Pool

**Stammdaten splits the way a Veranstaltung splits**: `/stammdaten` is the pool and nothing
else; the setup lists live one level down. The daily-versus-rare line is **the same line in
both halves of the app**.

A single screen holding the pool plus three folded managers was prototyped and rejected: at
142 Personen the folds sat a long way down, and **a closed `<details>` also hides that the
Import-Zuordnungen exist at all** — the exact gap this design added them to fix. The cost B
pays is two more sidebar rows and an Einrichtung screen that is a stack of three managers;
accepted, because the stack is now *all* that screen does rather than three managers wrapped
around a list they are not part of.

**Columns:** `Person · LARP-Erfahrung · Volljährig · Teiln. · Zuletzt · Notiz`, sortable on
Person, Teiln. and Zuletzt.

- **The pool holds no controls.** Person-Feld values arrive by **Import**, never by a sweep
  through the pool, so every cell is text and editing happens on `/person/<id>`. **The name
  is the only control in a row**: 142 rows cost 142 tab stops instead of 426.
- **Person-to-Events is a count plus the most recent Veranstaltung** — `Teiln.` = 6,
  `Zuletzt` = *Skaven / Mövennest*. The full list is on the Person screen. Naming every
  Veranstaltung in a row is unbounded; the count answers *does this person come back?* and
  `Zuletzt` answers *are they still around?*, which is what the pool is read for.
- **Orphans are a filter chip, not a hidden class.** `Ohne Teilnahme · 6` toggles them alone;
  `Zuletzt` reads `ohne Veranstaltung` for them. ADR-0005 retains them, so the screen states
  them rather than explaining them.
- **`globe` is not per column here.** Everything in Stammdaten is global, so the mark is
  stated **once in the legend** under the pool, not on six headings. It stays a per-column
  mark on the Teilnehmer register, where global is the rare case.
- **Erasure is not on this screen** — it left the pool row for the Person screen.

### States

Tier 1: **Stammdaten's empty action is `Veranstaltung anlegen`, not a create-Person form.**
Personen arrive with an Import into a Veranstaltung, so an empty pool's honest fix is
upstream — and §9 forbids an empty state whose action does not lead anywhere.

---

## `/stammdaten/einrichtung` — the rare half of the pool

A stack of three managers, each a Blatt (§8), each with its own tier-1 empty state.

### Person-Felder

The global Custom Field definitions. Renaming is the §5 single-field in-row swap; removal
raises the §7 Confirm dialog with its cascade sentence.

### Import-Zuordnungen

They have **no UI at all today** and accumulate forever. They get one here:
**rename · duplicate (`copy`) · remove**.

**No column editor.** Remapping happens **during an Import**, against a real file, saved back
under the same name — which is the only place the columns can be judged. The row expands to a
read-only `Spalte → Ziel` list.

Its tier-1 empty state has **no action at all**, because a Zuordnung cannot be created
outside an Import.

### Export-Ansichten (Person level)

The same register as `/event/<id>/export`, at Person level: rename · duplicate · download ·
remove, columns as static chips, the editor at `/stammdaten/einrichtung/<viewId>`.

---

## Cross-screen summary

### The four registers

| Register | Rows | Row tab stops | Row actions |
|---|---|---|---|
| Übersicht | 10–40 | 54 at 18 | `pencil`, `trash-2` |
| Teilnehmer | 50–150 | ~360 at 120 | `pencil`/`chevron`, `trash-2` |
| Import review | ~150 | **~150** | one radio group |
| Personen-Pool | ~142 | 142 | none |

Each gets a sticky `thead` at `--frame-h`, a `Register überspringen` skip link, `aria-sort`
on sortable heads, and the arrow layer (§13).

### Where each write reports

| Effect | Reported |
|---|---|
| Any edit of an existing record | **nowhere** — no write announces itself (§0.1) |
| Creation | the record appears; the form closes |
| Löschung cascade | frame status line |
| Rollen-Kopie | frame status line |
| CSV download | frame status line |
| `Übernehmen` into another Veranstaltung | frame status line |
| Import commit | the **Bericht**, on screen — not the status line |
| A failed write | the frame banner, `--danger`, once per session (§3) |
| A waiting version | the frame banner, neutral, held behind a failure (§3) |
| Offline capability | **never** — a deliberate omission |
