# TODO

Shared backlog for product work that is intentionally deferred from the current change. Keep this file updated when important missing features should stay visible across plans and implementation phases.

## High Priority

- Deck legality verification
  - Validate submitted decklists against the selected format when tournament setup enables verification.
  - Show clear verification outcomes for organizers and players without exposing noisy internal details in the public thread summary.
- Decklist ingestion to external hub sites
  - Support publishing or syncing submitted decklists to a hub site such as ManaVault.gg.
  - Preserve any returned deck URLs or identifiers so published tournament views can link to canonical deck pages.

## Follow-On Workflow

- AI-assisted photo reading
  - Process image-based deck submissions into structured deck entries.
  - Feed OCR or model output back into the same verification and publish pipeline as text or URL submissions.
- Organizer-only tooling expansion
  - Decide whether the organizer page should support richer field edits beyond removing players.
  - Consider whether organizers need verification controls, publish corrections, or more detailed private status than the current lightweight page.

## Later UX
- Continue refining the tournament post and publish copy as later workflow stages are implemented.
- Tournament naming collision handling
  - Check whether a tournament thread with the same name already exists in the same channel before creating a new one.
  - For manual/custom entry, prompt the organizer to confirm that reusing the name is intentional.
  - For default tournament names, append or increment a visible count so repeated default tournaments are easier to distinguish.
