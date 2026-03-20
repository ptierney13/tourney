# TODO

Shared backlog for product work that is intentionally deferred from the current change. Keep this file updated when important missing features should stay visible across plans and implementation phases.

## High Priority

- Deck legality verification
  - Validate submitted decklists against the selected format when tournament setup enables verification.
  - Show clear verification outcomes for organizers and players without exposing noisy internal details in the public thread summary.

## Follow-On Workflow

- Organizer-only tooling expansion
  - Decide whether the organizer page should support richer field edits beyond removing players.
  - Consider whether organizers need verification controls, raw-input correction tools, publish corrections, or more detailed private status than the current lightweight page.

## Operations

- Oracle Always Free deployment readiness
  - Treat moving the bot and organizer page onto an always-on Oracle Cloud Always Free VM as an expected eventual step once local-only running becomes limiting.
  - Prepare for the deployment cutover with stable public organizer URLs, background process supervision, and persisted bot data on the Oracle host.

## Later UX
- Continue refining the tournament post and publish copy as later workflow stages are implemented.
- Tournament naming collision handling
  - Check whether a tournament thread with the same name already exists in the same channel before creating a new one.
  - For manual/custom entry, prompt the organizer to confirm that reusing the name is intentional.
  - For default tournament names, append or increment a visible count so repeated default tournaments are easier to distinguish.
