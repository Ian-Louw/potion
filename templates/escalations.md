# Escalations — standing grants for gated mutations

This registry is the sanctioned lane for recurring gated mutations (deploys,
publishes, prod writes). Spawned workers cannot receive interactive permission
approval — a grant here lets the PermissionRequest hook auto-approve a command
you already said yes to, in writing, in the repo. Only a human edits this file
(no skill writes it); the commit is scrubber-screened like any `.potion/`
commit. Matching is exact-match only — trimmed full-string equality, no globs,
no prefixes, no argument templating. Default expiry: 90 days from `added`.

## Grammar

One grant per line:

```
- {escalation: "<name>", wrapper: "<repo path>", command: "<exact form>", granted_by: "<who>", added: YYYY-MM-DD, expires: YYYY-MM-DD}
```

The `command` value MUST be double-quoted and must not contain double quotes
or newlines. Other values may be unquoted. Every grant carries a mandatory
`expires` date — an entry without one is never approved.

Pad nothing inside the quotes: the hook trims the INCOMING command but
matches the registry command verbatim — spaces inside the quotes create a
grant that never matches (fails closed).

## Grants

- {escalation: "deploy-prod", wrapper: "scripts/deploy.sh", command: "sh scripts/deploy.sh --prod", granted_by: "ian", added: 2026-07-20, expires: 2026-10-18}

## Renewal

An expired grant simply stops matching — the command walls again. To renew,
bump `expires` on its line: one conscious edit, one screened commit.
