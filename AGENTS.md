# Repository Workflow

## Git Default

- Do not commit directly to `main`.
- For any code change, create a branch with the `codex/` prefix.
- Commit work on that branch.
- Push the branch to `origin`.
- Open a pull request for review instead of pushing changes directly to `origin/main`.

## Plans

- Add a dated plan file in `Plans/` only when a real implementation plan was created as part of deciding and executing a substantial change.
- The saved file should be the actual plan that was used to drive the work, not a post-hoc summary written after the fact.
- Do not create plan files for small maintenance edits, documentation-only tweaks, or other minor changes that did not rely on a formal planning step.
- When a plan file is included, keep the implemented scope aligned with that plan.

## Deployment Direction

- Treat local development as the default day-to-day workflow, but assume the product will eventually need to run from an always-on Oracle Cloud Always Free VM.
- Do not frame Oracle hosting work as speculative polish. For this repo, it is the expected long-term deployment path once local-only operation stops being sufficient.
- When a change affects runtime networking, persistence, background execution, or organizer-link behavior, make sure the docs still line up with that eventual Oracle deployment target.

## Verification

- Run the relevant validation before opening a PR.
- For this repo, prefer at least:
  - `npm run build`
  - `npm test`
