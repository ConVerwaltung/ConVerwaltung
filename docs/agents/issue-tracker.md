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

## Notes

- `.scratch/` is for ephemeral working issues. If you want issues version-controlled, ensure `.scratch/` is **not** gitignored.
- Labels come from `docs/agents/triage-labels.md`.
