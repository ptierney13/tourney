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
- Organizer-only tooling
  - Decide whether organizer-only views should show more detail than the public thread summary.
  - Consider whether organizers need a richer admin surface for review, verification, or publish corrections.

## Later UX
- Continue refining the tournament post and publish copy as later workflow stages are implemented.
