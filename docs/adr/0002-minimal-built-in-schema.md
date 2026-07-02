# Minimal built-in schema; everything else is a Custom Field

The only hard-coded fields are `Person.name` and the structural fields of a Participant (`event`, `person`, `roles`), plus a single free-text Note on both Person and Participant. Every other piece of participant data — email, phone, allergies, ticket type, room, payment status, and so on — is an organizer-defined Custom Field, not a built-in column.

## Why

Import columns are organizer-defined and vary per event (see [ADR-0001](./0001-fuzzy-participant-matching.md)), and the product's purpose is to let organizers *extend* records with their own custom data. A fixed contact-card schema (name/email/phone/address) would privilege fields the flexible model should leave to the organizer, and would still never match every event's actual columns. Name is the sole exception because identification and fuzzy matching depend on it.

## Consequences

- No built-in email/phone/address. A future reader must not "fix" their absence — it is deliberate. Those are expected to exist as Person Custom Fields.
- Custom Fields exist at two levels: Person-level (global across events) and Participant-level (per event). See CONTEXT.md.
- Adding a built-in field later is possible but should be resisted unless a field is genuinely universal and structurally special (as name is).
