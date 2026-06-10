# AGENTS.md — Nihil Lane 4: vendor-prep (Devin)

This is ONE lane of a parallel effort on Nihil. These rules bind all work.

## Hard boundaries
- Branch: `lane/vendor-prep` only. NEVER merge or push to main. This
  branch is a STAGING study consumed during M2 — it is parked, not merged.
- WRITE access: a new top-level `vendor-prep/**` directory only.
- READ-ONLY everything else in the nihil repo. Never modify existing files.
- Source material: clone https://github.com/nexu-io/open-design into your
  own workspace (NOT into the nihil repo). Pin the sha you study.

## License rules (non-negotiable)
- open-design is Apache-2.0: extraction is permitted WITH attribution.
- Every extracted file gets a header:
  `// Vendored from nexu-io/open-design @ <sha> — Apache-2.0, see NOTICE`
- Record sha + full file list in vendor-prep/VENDOR.md.
- Draft NOTICE additions in vendor-prep/NOTICE-draft.md.
- Never pull in code that open-design itself vendored from non-Apache/MIT
  sources — check headers and their NOTICE first.

## Conventions
- English. Conventional commits (`docs(vendor): …`, `chore(vendor): …`).
- Flag anything requiring out-of-lane changes in VENDOR-PLAN.md "Flags";
  never make those changes.
