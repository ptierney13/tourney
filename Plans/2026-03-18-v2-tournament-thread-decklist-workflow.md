# V2 Tournament Thread Decklist Workflow

## Summary

Expand the Tourney bot from a single DM submission scaffold into a lightweight tournament workflow with three commands:

- `/tourney` starts in a server channel, moves setup into DM, collects the tournament name, and creates a dedicated thread.
- `/submit` works only inside a Tourney-created thread, moves decklist intake into DM, and saves one latest decklist per player name.
- `/publish` works only for the tournament creator inside the tournament thread, walks the organizer through optional placement or score entry for each saved deck, and posts or updates one canonical summary message in the thread.

Persist all tournament state in local JSON files so tournaments survive restarts and can be republished.

## Key Changes

- Add slash commands for `/tourney`, `/submit`, and `/publish`.
- Restrict tournament actions to bot-created tournament threads by persisting thread-to-tournament metadata.
- Add a file-backed tournament store that persists:
  - tournament id, name, creator, source channel, and thread id
  - created and published timestamps
  - published summary message id
  - deck submissions keyed by normalized player name
  - optional placement or score text for each saved submission
- Add reusable DM prompt helpers for free-form text and simple choices.
- Render one canonical tournament summary message and update it on republish instead of posting duplicates.
- Update repo docs and env examples to cover the new workflow and local data directory.

## Public Interfaces / Behavior

- `/tourney` is available in standard guild text channels where the bot can create threads.
- `/submit` and `/publish` only work inside registered tournament threads.
- Tournament creator permissions are enforced for `/publish`.
- Self-submissions default the player name from the user’s visible Discord identity; submissions for others use a free-form player name.
- Repeated submissions for the same player name overwrite the prior saved decklist.
- Local persistence defaults to `./data` and can be overridden with `TOURNEY_DATA_DIR`.

## Test Plan

- Verify the TypeScript build succeeds after adding tournament storage, DM helpers, and new commands.
- Verify store behavior for:
  - creating and reloading tournaments
  - overwriting submissions by normalized player name
  - saving placement text and publish metadata
  - gracefully handling corrupt JSON store contents
- Verify tournament helper behavior for:
  - player-name normalization
  - thread-name generation
  - default self-submission player naming
  - summary rendering with optional placement or score text
- Manually verify the Discord flows for:
  - tournament creation from a guild channel
  - deck submission from a tournament thread
  - creator-only publish and republish behavior

## Assumptions

- v2 uses minimal local-file persistence rather than an external database.
- Tournament identity is thread-scoped; the thread is the source of truth for submissions and publishing.
- Placement and score data are stored as simple free-form text in v1 of publishing.
- Only one canonical published summary message should exist per tournament thread.
