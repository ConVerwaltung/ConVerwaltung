# Initial release is single-device; defer merge and Library transfer

Status: accepted — defers [ADR-0004](./0004-field-level-three-way-merge.md) and the merge-dependent parts of [ADR-0005](./0005-person-erasure.md) and [ADR-0006](./0006-plain-store-in-memory-model.md).

For the first release the app persists to a single device's IndexedDB only ([ADR-0003](./0003-offline-first-pwa.md)). The multi-device path is deferred: the full-fidelity Library file transfer, the field-level three-way merge ([ADR-0004](./0004-field-level-three-way-merge.md)) and the per-field change-tracking metadata it requires on every record, and the merge-override behaviour of Erasure ([ADR-0005](./0005-person-erasure.md)). Records carry **no change-tracking metadata** for now.

## Why

Merge is the system's most complex component (ADR-0004, ADR-0006 both say so). Building it before a working single-device product exists is premature complexity. Deferring it lets the import, custom-field, note, export, and erasure flows ship against a plain store, and lets merge be designed later — when multi-device transfer is an actual requirement rather than an anticipated one.

## Considered options

- **Build merge up front** — rejected: largest, hardest part of the system, blocking the simpler product behind it (YAGNI).
- **Add per-field change-tracking metadata now as cheap insurance, but no merge logic yet** — rejected: the per-field versioning *is* the bulk of the cost and would be dead weight with nothing reading it; populating it correctly on every edit is exactly the bookkeeping being deferred.

## Consequences

- No per-field change-tracking metadata on records. Introducing merge later is a data-model migration to add it — a known, accepted future cost.
- Library data lives on one device. No laptop↔phone transfer in this release; until merge ships, moving data is either single-device-only or via lossy CSV re-import.
- **UUID v7 keys (ADR-0006) are kept.** IDs assigned at creation cost nothing now and make a later merge cheaper; only the per-field *versioning* is dropped, not stable identity.
- Erasure (ADR-0005) remains as complete on-device removal — its data-protection purpose holds on a single device. Only its merge-override and tombstone-propagation behaviour is out of scope until merge ships.
- ADR-0006's plain `idb` store with an in-memory Library stays in force; only its hand-written-merge component is deferred.
- The domain language for Merge, Conflict, and Library (CONTEXT.md) stays — the concepts remain valid; only their implementation is postponed.
