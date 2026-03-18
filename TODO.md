# TODO

Shared backlog for product work that is intentionally deferred from the current change. Keep this file updated when important missing features should stay visible across plans and implementation phases.

## High Priority

- Deck legality verification
  - Validate submitted decklists against the selected format when tournament setup enables verification.
  - Show clear verification outcomes for organizers and players without exposing noisy internal details in the public thread summary.
- Decklist ingestion to external hub sites
  - Support publishing or syncing submitted decklists to a hub site such as ManaVault.gg.
  - Preserve any returned deck URLs or identifiers so published tournament views can link to canonical deck pages.

## Near-Term Workflow

- Submission flow
  - Support entering a deck for yourself or another player.
  - Support deck submission by pasted list, deck URL, or image upload.
  - Add AI-assisted photo reading for image-based deck submissions.
  - Run format verification silently when enabled and reprompt on verification failure.
- Publish flow
  - Support publishing without results, with direct placements, or with records that calculate placement.
  - Support record-only publish mode for events without a top cut.
  - When results are skipped entirely, publish an alphabetical player list without result columns.
  - Support optional archetype collection during publish.
  - Show each player's current info and decklist while stepping through publish prompts in DM.
- Published tournament view
  - Use the compact `Placement | Player | Record | Deck` layout when deck URLs fit inline.
  - Fall back to block-style deck presentation for multiline text or oversized entries.

## Later UX

- Decide whether organizer-only views should show more detail than the public thread summary.
- Continue refining the tournament post and publish copy as later workflow stages are implemented.
