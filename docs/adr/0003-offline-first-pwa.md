# Offline-first PWA, on-device storage, transfer by Library file — no server or sync

The app is an offline-first Progressive Web App that runs entirely on each device (phone or laptop) and stores the whole Library in the browser's IndexedDB. There is no backend server and no automatic synchronization. Data moves between devices by exporting the full-fidelity Library to a file on one device and importing it on the other.

## Why

It must work standalone on a phone at the event with no laptop present and no reliable internet — event venues are notoriously bad for connectivity. It also holds participants' personal data (allergies, contacts, emergency contacts) that should not sit on a third-party server. Offline-first with on-device storage satisfies both. A cloud/server-sync model was rejected because it reintroduces the internet dependency and the privacy exposure the offline model exists to avoid.

## Consequences

- **No SQLite.** IndexedDB is the idiomatic offline store; a SQLite-wasm build would be heavier for no benefit at event scale (the whole Library fits in memory).
- **Two export paths, different purposes:** the Export View (configurable CSV for reports/lists) and the Library export/import (full-fidelity, for device transfer and backup). CSV cannot round-trip the whole graph — multiple events, the shared Person pool, custom-field definitions, roles, notes — so the Library file is required for transfer.
- **The same data cannot live on two devices automatically.** The sole operator must move the Library file deliberately. Without discipline, edits made on a device since the last transfer can be lost. How import reconciles with existing local data (replace vs merge) is a separate decision.
- **Single-operator only.** This architecture does not support concurrent multi-user editing; that was already ruled out.
