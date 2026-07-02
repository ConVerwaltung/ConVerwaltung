# Person-level erasure removes all personal data across events and overrides Merge

Status: partially deferred — complete on-device removal applies in the initial release; the Merge-override and tombstone-propagation behaviour waits for merge ([ADR-0007](./0007-defer-merge-single-device-first.md)).

Deleting a Person is an **erasure**: it removes the Person and all of their Participants, custom values, and notes across every event. Erasure is recorded as a tombstone that propagates through Merge, and — unlike an ordinary delete — it **takes precedence over any concurrent edit**: an erased Person stays erased and is never offered as a resolvable Conflict, even if the other device edited that Person after the erasure.

## Why

The Library holds participants' personal data (allergies, contacts, emergency contacts). EU/German data-protection law (right to erasure) requires being able to fully remove an individual's data on request. Because the model keeps a persistent cross-event Person and retains orphan Persons as cross-event memory (see CONTEXT.md), ordinary scoped deletes (an Event, a Participant) never fully remove someone — so an explicit, complete erasure path is required.

The Merge override exists because the alternative is unacceptable: under the normal delete-vs-edit rule ([ADR-0004](./0004-field-level-three-way-merge.md)), merging a stale Library from another device could resurrect an erased Person or force the operator to "resolve" whether to keep legally-deleted data. Erasure must be final regardless of what the other device did.

## Consequences

- Erasure cascades to every event's Participant for that Person, plus their notes and custom values.
- Erasure is a deliberate exception to the ADR-0004 rule that delete-vs-edit is a surfaced Conflict; for erasure, deletion wins unconditionally.
- Distinct from deleting an Event or a Participant, which are scoped and leave the Person intact.
- Orphan Persons (zero Participants) are otherwise retained; erasure is the only path that fully removes a Person.
