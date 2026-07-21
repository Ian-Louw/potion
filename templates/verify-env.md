<!-- Declaration-required: this file existing in one of the two shapes is what
     lets /potion:plan schedule runtime-proof truths. Silence is the only
     illegal state. Pick ONE shape and delete the other. -->

<!-- ============ Shape A: session recipe ============ -->

# Verify-env — runtime session recipe

- How a verifier gets a live session: <!-- login flow, emulator recipe, or "hit staging URL" -->
- Test account identifier: <!-- username/email only — never the password -->
- Seed/reset command: <!-- e.g. `npm run db:seed` — leaves the account in a known state -->
- Staging/base URL: <!-- where the running app lives -->

Secret values — including fixture-account passwords — live in
`.potion/verify-env.local` (gitignored) as KEY=value, never in this file.
Reference them BY NAME (e.g. `password: see APP_PROD_FIXTURE_PASSWORD
in verify-env.local`). Every declared value doubles as a literal scrub
pattern: the commit hook blocks any commit containing it.

<!-- ============ Shape B: declaration ============ -->
<!-- The entire file is one line. Example: `none-needed: CLI tool, no auth, no external services` -->

none-needed: <why>
