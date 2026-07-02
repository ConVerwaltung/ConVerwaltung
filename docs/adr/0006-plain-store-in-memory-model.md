# Plain IndexedDB store with an in-memory Library; merge is hand-written, not delegated to a local-first database

Status: partially deferred — the plain `idb` store and in-memory Library apply now; the hand-written merge component waits for merge ([ADR-0007](./0007-defer-merge-single-device-first.md)).

The Library is held in memory as the single source of truth, loaded from a plain `idb`-backed IndexedDB store at boot and written through on change. (Initial release uses this store single-device only — [ADR-0007](./0007-defer-merge-single-device-first.md).) Reconciliation — the field-level three-way merge of [ADR-0004](./0004-field-level-three-way-merge.md) — is implemented as the project's own pure domain logic. Local-first / sync databases (RxDB, Yjs/CRDT, Replicache, TinyBase-sync) are deliberately not used.

## Why

[ADR-0003](./0003-offline-first-pwa.md) establishes offline-first storage in IndexedDB (not SQLite) with the whole Library fitting in memory. Loading everything into memory makes the domain operations — merge, import matching, export filtering, erasure cascade — synchronous and pure, keeping I/O at the edge per the project's domain-vs-I/O separation. IndexedDB then serves purely as a persistence boundary.

The merge model of ADR-0004 is a field-level three-way merge that **surfaces** conflicts for explicit operator resolution. Local-first databases ship their own reconciliation — CRDTs (Yjs) or last-writer-wins (RxDB/Replicache defaults) — which silently resolve exactly the conflicts ADR-0004 requires to be surfaced. Adopting one would mean fighting or bypassing its central feature, while its sync engine sits unused because there is no server (ADR-0003).

## Considered options

- **Local-first / sync database (RxDB, Yjs/CRDT, Replicache, TinyBase-sync)** — rejected: imposes CRDT or last-writer-wins merge semantics that contradict ADR-0004's surfaced-conflict requirement; the bundled sync engine is dead weight given the no-server model, while adding lock-in.
- **Query-against-IndexedDB per view (Dexie-style)** — rejected: makes every domain operation async and couples logic to the store for no benefit when the whole Library fits in memory; it also complicates the pure three-way merge and forces a fake DB into unit tests.
- **Raw IndexedDB API** — rejected in favor of `idb`: identical model, but `idb` removes the verbose request/transaction boilerplate at the persistence edge.

## Consequences

- All domain logic is pure and synchronous over in-memory state; IndexedDB is touched only by a thin load/persist layer. Unit tests run against plain objects; `fake-indexeddb` covers the persistence edge.
- The hand-written merge is the most complex part of the system (already noted in ADR-0004). That complexity is owned in-house rather than delegated — which is the point: it is the only way to honor the surfaced-conflict requirement.
- Boot cost is one full read of the store into memory; mutations write the changed record(s) through. Acceptable at event scale (low thousands of records, a few MB).
- Records are keyed by UUID v7 (ADR-0004 assigns IDs at creation). v7 is time-ordered, so object-store keys cluster by creation order and yield a natural default sort; generated via the `uuid` package, since native `crypto.randomUUID()` emits only v4.
- If multi-device sync without manual file transfer were ever required (explicitly out of scope per ADR-0003), this decision would need revisiting — a sync database might then earn its place.
