<!--
Spec files are current truth, mutated only by scripts/merge-specs.sh on ship
(or by a human); requirement IDs are permanent handles — verifiers and
witnesses cite them.
-->
<!-- Format rules (the merge script's parsing depends on these):
- `### Requirement: ` is the ONLY H3 form allowed; id matches [a-z0-9-]+,
  unique within the file; ` — ` (space-emdash-space) separates id from
  statement.
- A requirement block runs from its header line to the line before the next
  `### ` header or EOF.
- >=1 scenario per requirement; a scenario is a consecutive GIVEN/WHEN/THEN
  bullet group (optional AND bullets); blank line between scenarios.
- Optional `<!- - source: path - ->` line directly under the header
  (without the inner spaces).
-->

# {Capability name} — spec

Purpose: {1-3 lines: what this capability guarantees}

### Requirement: {kebab-id} — {one-line normative statement}
<!-- source: {repo path that implements this} -->

- GIVEN {precondition}
- WHEN {action or event}
- THEN {observable outcome}
- AND {optional extra outcome}
