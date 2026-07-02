# Match returning participants by interactive fuzzy review, not a key

When importing a participant list into an event, the system must decide whether each row is a returning Person (link to the existing identity) or a new one. We match by proposing name-similarity candidates that the organizer confirms or rejects per row, rather than upserting on a deterministic key (e.g. email).

## Why

Import columns are organizer-defined via an Import Mapping; no stable, reliable identifier is guaranteed to exist in every source CSV. A key-based upsert would silently fail or duplicate whenever the key column is absent, blank, or inconsistent. Fuzzy review trades automation for not depending on data we cannot assume is present.

## Consequences

- Import is inherently two-phase and interactive: parse → propose matches → organizer confirms → commit. It cannot run fully headless.
- A name-normalization/similarity mechanism is required (e.g. "Mueller" ≈ "Müller").
- False matches are possible (two real people with the same name) and false misses are possible (a person who changed their name); the per-row confirmation step is the mitigation.
- If a reliable key ever becomes available, key-based matching can be added as an additional candidate source without removing the review step.
