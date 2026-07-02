# Reconcile divergent Libraries by field-level three-way merge with surfaced conflicts

Status: deferred — not in the initial release; see [ADR-0007](./0007-defer-merge-single-device-first.md). The decision below stands for when merge is built.

When a Library is merged into a device that already holds diverged data, reconciliation is a **field-level three-way merge**: each device tracks the Library version it last synced from (the base); non-conflicting field changes from both sides are applied automatically; fields changed to different values on both sides are surfaced as **Conflicts** for the sole operator to resolve. Records are matched by stable IDs assigned at creation; Persons created independently on each device are reconciled via the fuzzy-match flow ([ADR-0001](./0001-fuzzy-participant-matching.md)). Deletions are recorded as tombstones; delete-vs-edit is a Conflict.

## Why

The operator works across a laptop (prep) and a phone (on-site) with no server and no automatic sync ([ADR-0003](./0003-offline-first-pwa.md)). Without merge, two diverged copies could never be unified without losing one side's work — the operator flagged that as unacceptable. Field-level merge preserves edits made to *different* fields on each device. Surfacing conflicts, rather than silently picking a winner, guarantees no edit is discarded without the operator's explicit decision.

## Considered options

- **Replace wholesale + staleness warning** — rejected: silently loses the overwritten device's edits.
- **Silent newest-wins (last-writer-wins)** — rejected: silently discards one side of a true conflict, defeating the reason merge was chosen.
- **Record-level merge** — rejected: loses one record's edits when different fields of the same record changed on each device.

## Consequences

- Every record carries change-tracking metadata (per-field versioning) plus a per-device base-version pointer.
- Deletions require tombstones to propagate correctly and avoid resurrecting deleted records.
- A conflict-resolution UI is required.
- A Note is a single free-text field (see CONTEXT.md), so a note-vs-note conflict is a choice between two whole texts, not an automatic union — the operator picks or hand-combines.
- This is the most complex component in an otherwise KISS system; the complexity is intentional and bounded to the merge path.
- Merge reuses the ADR-0001 fuzzy-matching flow for independently-created Persons.
