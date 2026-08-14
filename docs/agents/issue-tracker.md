---
name: issue-tracker
description: How the engineering skills create, find, and update issues as local markdown files under .scratch/.
---

# Issue tracker — local markdown

Issues for this repo live as markdown files under `.scratch/<feature>/` at the repo root. There is no remote issue tracker; this file tells the engineering skills how to create, find, and update issues locally.

## Layout

```
.scratch/
  <feature-slug>/
    0001-<issue-slug>.md
    0002-<issue-slug>.md
    ...
```

- One directory per feature/initiative (`<feature-slug>`, kebab-case).
- One markdown file per issue, numbered sequentially within the feature: `0001-`, `0002-`, …
- Issue number is unique within the feature directory, not globally.

## Issue file format

```markdown
---
title: <short imperative title>
labels: [<triage-label>, ...]
status: open | closed
created: <YYYY-MM-DD>
---

<issue body — see the skill that created it for structure>
```

## Operations

- **Create an issue**: pick the feature directory (create it if new), find the highest existing number in it, increment, write a new `NNNN-<slug>.md` file with frontmatter.
- **Find issues**: glob `.scratch/**/*.md`; filter on the `labels:` / `status:` frontmatter fields.
- **Update an issue** (e.g. triage): edit the `labels:` or `status:` frontmatter in place.
- **Close an issue**: set `status: closed` in frontmatter.

## Wayfinding operations

The wayfinder skill charts a **map** and its **tickets** as issues in one feature
directory. This tracker has no native parent/child or dependency links, so both are body
and frontmatter conventions:

- **The map** is the first issue in the feature directory (`0001-*.md`), labelled
  `wayfinder:map`. Its body holds Destination, Notes, Decisions so far, Not yet specified,
  and Out of scope.
- **A ticket** is any other issue in the same directory, carrying `map: 0001-<slug>.md` in
  its frontmatter and one `wayfinder:research | prototype | grilling | task` label
  alongside its triage labels.
- **Blocking** is a `## Blocked by` list of ticket filenames in the body. A ticket is
  unblocked when every ticket it lists has `status: closed`.
- **Claiming** is an `assignee:` frontmatter field, set before any work begins.
- **The frontier** is every ticket in the directory that is `status: open`, unblocked, and
  has no `assignee:`.
- **Resolving** a ticket appends a `## Resolution` section to its body, sets
  `status: closed`, and adds one line to the map's Decisions so far linking the file.

## Notes

- `.scratch/` is for ephemeral working issues. If you want issues version-controlled, ensure `.scratch/` is **not** gitignored.
- Labels come from `docs/agents/triage-labels.md`.
