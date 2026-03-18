# Plans

This folder stores implementation plans that were actually used to decide and guide substantial code changes, so reviewers can compare the final implementation against the intended scope.

## Naming Convention

Use filenames in this format:

`YYYY-MM-DD-short-description.md`

Examples:

- `2026-03-17-v1-bootstrap-discord-bot.md`
- `2026-03-20-add-tournament-submission-validation.md`

## Guidelines

- Only add a plan file when a real plan was produced before or during implementation and that plan materially guided the change.
- The file should contain the actual plan that was shared and used for execution, not a retrospective summary of what changed.
- Do not add plan files for small fixes, tiny documentation updates, or routine maintenance that did not require a formal planning step.
- Create at most one plan file per substantial workstream that was actually planned.
- Prefix every file with the plan date to preserve chronological order.
- Keep the description short and specific to the change.
- When applicable, prefer updating code and adding the corresponding plan file in the same change.
- Treat these plans as review aids, not as a replacement for commit history.
