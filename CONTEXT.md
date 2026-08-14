# AMTS — Adaptives Teilnehmer-Management-System

Software for managing events: importing the people involved, enriching them with custom data and notes, and exporting the result in a structured form.

## Language

**Event**:
_German_: Veranstaltung
A single event. The top-level entity; everything else (participants, custom fields, notes, exports) is scoped to one event. Recurring/annual events are separate events.
_Avoid_: Con, convention, game, occasion

**Person**:
_German_: Person
A human identity that persists across events (name, contact, stable attributes of the real individual). The same Person can be a Participant at many events over time.
_Avoid_: Individual, attendee, user

**Participant**:
_German_: Teilnehmer
A specific Person's involvement in a specific Event. Carries that person's role(s), custom data, and notes for that event. The same Person yields a distinct Participant at each event they attend.
_Avoid_: Attendee, Registration, Participation

**Role**:
_German_: Rolle
The capacity in which a Participant takes part in an event (e.g. guest, speaker, volunteer, organizer). The set of available roles is defined by the organizer per event (and can be copied from a previous event). One Participant can hold several roles at once.
_Avoid_: Type, category, kind

**Custom Field**:
_German_: Benutzerdefiniertes Feld
An organizer-defined, named and typed data slot. Defined at either level: Person-level fields are global (apply to every Person across all events); Participant-level fields are defined per event. Values are recorded against the definition per record. The home for any data that should be filtered, validated, or exported as a column.
_Avoid_: Attribute, property, column, key

**Note**:
_German_: Notiz
A single multiline free-text field on a Person or a Participant for unstructured commentary. Not a list of discrete entries; remarks are separated by line breaks within the one field. The home for one-off remarks that do not warrant a defined Custom Field.
_Avoid_: Comment, remark, memo

**Import**:
_German_: Import
Reading an external participant list (currently CSV) into an event, creating or updating Persons and their Participants. The source columns are not fixed; an Import Mapping describes how to read them.
_Avoid_: Upload, load, sync

**Import Mapping**:
_German_: Import-Zuordnung
A reusable, named configuration describing how to interpret a source file: which column feeds which target (identity, Person field, Participant field, role) and which column or columns identify the Person — several identity columns (Vorname, Nachname) are joined in file order into one name. Defined once per file shape and reused across events.
_Avoid_: Import profile, template, parser, schema, recipe

**Export View**:
_German_: Export-Ansicht
A reusable, named selection that defines a structured export: the level (Person or Participant), a filter over the records, and which fields become which output columns. Produces a flat CSV for reports/lists, re-importable as participant rows via an Import Mapping. Not a full-fidelity transfer — for that, see Library.
_Avoid_: Report, export profile, export mapping, query

**Library**:
_German_: Bibliothek
The complete dataset held on one device — all Events, the shared Person pool and their data, and the organizer's Import Mappings and Export Views. The unit moved between a laptop and a phone via a full-fidelity export/import file (distinct from an Export View's CSV), and the scope across which Merge operates.
_Avoid_: Database, store, dataset, backup, collection

**Merge**:
_German_: Zusammenführung
Reconciling an incoming Library with the data already on a device into one unified state. A field-level three-way comparison: non-conflicting changes from both sides are applied automatically; differing changes to the same field become Conflicts. The Library-transfer counterpart to import.
_Avoid_: Sync, reconcile, combine, integrate

**Conflict**:
_German_: Konflikt
A single field changed to different values on both devices since their last shared state, requiring the operator to choose which value to keep during a Merge.
_Avoid_: Clash, collision, discrepancy

**Erasure**:
_German_: Löschung
Deleting a Person outright — removing them and all their Participants, custom values, and notes across every event. The complete-removal path for data-protection requests. Unlike scoped deletes (Event, Participant) it leaves nothing, and unlike an ordinary delete it overrides Merge: an erased Person is never resurrected or offered as a Conflict.
_Avoid_: Delete, removal, forget, purge
