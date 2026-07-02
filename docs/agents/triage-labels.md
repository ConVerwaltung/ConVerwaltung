# Triage labels

The five canonical triage roles and the label string each maps to in this repo's issue tracker.

| Role | Label | Meaning |
|------|-------|---------|
| needs-triage | `needs-triage` | Maintainer needs to evaluate |
| needs-info | `needs-info` | Waiting on reporter |
| ready-for-agent | `ready-for-agent` | Fully specified, AFK-ready — an agent can pick it up with no human context |
| ready-for-human | `ready-for-human` | Needs human implementation |
| wontfix | `wontfix` | Will not be actioned |

## Notes

- These strings are used verbatim by the `triage` skill. If you rename a label in your tracker, update it here too.
- For local-markdown and some trackers there's no pre-registration step; the label string is just written into the issue's `labels:` frontmatter.
