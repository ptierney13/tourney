# V3 Tournament Creation UI Refresh

## Summary

Refresh the `/tourney` setup flow so tournament creation feels like a lightweight form instead of a sparse DM exchange. The updated flow should support a one-click quick setup path, a more detailed setup path, and durable storage for new tournament-display metadata that later features can build on.

This plan is intentionally being updated live during product discussion so implementation can track the current agreed UX.

## Goals

- Make tournament creation feel more polished and guided.
- Add a non-chatty introductory step that reads like simple form UI.
- Support both fast default creation and a more configurable setup flow.
- Persist new tournament metadata for display choices and future format-aware features.
- Keep this change scoped to setup UX and stored data, not format validation logic.

## Non-Goals

- Do not implement actual deck legality verification in this change.
- Do not handle self-vs-other submission rules in this change.
- Do not redesign submission or publish flows beyond what is needed to honor the new stored metadata.

## Current Product Decisions

- The intro should read like form copy, not like an AI assistant speaking.
- The first setup step should offer:
  - a quick/default setup path
  - a detailed/custom setup path
- Quick setup should immediately create a tournament using sensible defaults.
- Detailed setup should collect:
  - tournament name
  - optional format
  - whether deck legality should be checked against that format later
  - optional subtitle or description
  - submission display mode
- Every tournament thread should have a summary at the top.
- The current tournament status post should be pinned when the bot has permission to do so.
- That thread summary should always show how many players have submitted.
- The organizer option is whether the summary also shows the names of submitted players.
- Submission display mode should support:
  - count only
  - count plus public player list
- "Hidden until publish" was considered and removed.
- Submission count should always live in the tournament summary at the top of the thread.
- If a format is selected, it should always be shown in the thread summary.
- The summary count label should use "players submitted".
- Legality verification should only be asked when a format is selected.
- Legality verification state should not be shown publicly in the thread summary.
- Self-vs-other submission handling is deferred to later work.
- Later publish flow should support three result-entry paths:
  - publish without entering results
  - enter placements directly
  - enter records and calculate placement
- The published tournament post should always list each player's decklist.
- Submission flow should collect a deck name in addition to the decklist.
- Submission flow should accept deck entries as pasted deck text, a deck URL, or an image upload.
- Published tournament views should include deck name together with the decklist in the same deck-related column or section.
- During submission, format verification should run silently in the background and only surface to the user when verification fails.
- If verification fails, the submission flow should show a clear failure message and reprompt for deck entry.
- Submission confirmation should include the full submitted entry, and should mention verification when verification was run.
- Published summaries should always show player names; hiding entrant names is only a pre-tournament thread-summary option.
- When results are skipped entirely, the published view should still look like a normal published summary, but players should be ordered alphabetically and result columns should be omitted.
- Publish flow should be able to require an archetype value for every deck and include it in the published results.
- If publish flow steps through players one at a time in DM, each prompt should include that player's current info, including the decklist.
- When republishing, the organizer should be able to choose between updating the existing published post and creating a new one.
- Pinning failures should never block tournament creation or publishing; they should fall back gracefully with a user-facing note.
- No additional published columns are needed beyond the current planned layout.
- Richer organizer-only or admin-facing views are out of scope for this workstream and can be revisited later.

## Proposed Detailed Setup Flow

1. `/tourney` is run in a guild text channel.
2. The bot opens a DM and presents a setup entry screen with concise form-style copy.
3. The organizer chooses either quick setup or detailed setup.
4. Quick setup immediately creates the tournament using stored defaults.
5. Detailed setup collects:
   - tournament name
   - optional subtitle or description
   - optional format from a predefined dropdown/list
   - legality verification enabled or disabled, only when a format is selected
   - submission display mode: count only or count plus public player list
6. The bot creates the tournament thread and posts the top summary using the selected settings.

## Proposed Quick Setup Defaults

- Tournament name defaults to `Community Tournament`.
- Format defaults to `Freeform`.
- Format legality verification defaults to off.
- Subtitle/description defaults to blank.
- Submission display defaults to count only.

## Finalized Format Selector

The optional format selector should include:

- Freeform
- Standard
- Pioneer
- Modern
- Legacy
- Vintage
- Pauper
- Commander
- Historic
- Explorer
- Timeless
- Brawl
- Alchemy

The v1 selector intentionally excludes Limited-style formats such as Draft and Sealed. Those formats are common, but future deck-legality verification for them would require a different workflow than constructed-format validation.

## Thread Summary Expectations

The summary shown at the top of the tournament thread should include:

- tournament name
- subtitle/description when present
- selected format when present
- an `X players submitted` count line
- a submitted-player section only when public player list mode is selected

When submitted-player names are shown publicly, they should be rendered as a line-separated list or table rather than a single inline text list.

That section should be implemented in a row-oriented way so it can naturally grow into a richer published view later, such as adding columns for placement, record, archetype, or deck link without redesigning the whole summary layout.

For published views, placement should come before player name in the row structure, and rows should be ordered by placement whenever placement data is available.

## Data Model Changes

Extend tournament persistence to store setup metadata needed by the new creation flow, likely including:

- optional format identifier
- format verification enabled flag
- optional subtitle or description
- submission display mode
- whether the tournament was created from quick setup or detailed setup

The exact property names can be finalized during implementation, but the data should be durable from the initial creation flow onward.

Tournament submissions should also evolve to store:

- deck name
- decklist content or decklist URL
- optional decklist image reference
- later verification metadata when that feature is implemented

## Planning Status

This planning round is finalized. Deferred implementation work and later product expansions should be tracked in `TODO.md`.

## Implementation Outline

- Update the DM setup flow in `/tourney` from a single prompt into a multi-step setup workflow.
- Add reusable prompt support as needed for setup branching and option selection.
- Extend tournament types, builders, and persistence for the new setup metadata.
- Update thread-summary rendering to honor subtitle, format, and submission display mode.
- Add or update tests for:
  - tournament creation defaults
  - stored setup metadata
  - summary rendering behavior for count-only vs count-plus-names display
  - backward-safe handling for tournaments created before the new fields existed

## Risks / Watchouts

- The new setup should stay lightweight; too many prompts will make creation feel slow.
- Form-style copy needs to stay concise so DM setup does not feel like a bot conversation.
- Stored metadata should be designed so future verification logic can plug in without another migration-heavy rewrite.
- Existing tournaments in local storage may not have the new fields, so rendering and publish behavior should handle missing values safely.

## Finalized Copy

### Setup Entry Screen

- Title: `Tournament Setup`
- Helper text: `Create the tournament with default settings, or customize the details.`
- Primary button: `Use Default Settings`
- Secondary button: `Customize My Tournament`

### Quick Setup Result

- Title: `Tournament Created`
- Helper text: `Community Tournament was created with default settings. Player names will stay hidden, and the thread summary will show players submitted.`
- Follow-up line: `Open the thread to start collecting deck submissions.`

### Detailed Setup: Tournament Name

- Title: `Tournament Name`
- Helper text: `Choose the name for your tournament.`
- Field label: `Tournament name`
- Placeholder: `Community Tournament`

### Detailed Setup: Tournament Description

- Title: `Tournament Description`
- Helper text: `Add an optional description for your tournament that will be posted in the tournament summary.`
- Field label: `Description`
- Placeholder: `Friday night event, store championship, webcam league, etc.`

### Detailed Setup: Tournament Format

- Title: `Tournament Format`
- Helper text: `Select a format for this tournament.`
- Field label: `Format`
- Default option: `Freeform`

### Detailed Setup: Deck Verification

- Title: `Deck Verification`
- Helper text: `Choose whether submitted decks should be checked against the selected format.`
- Field label: `Verify deck legality`
- Options:
  - `Yes, verify decks`
  - `No verification`

### Detailed Setup Result

- Title: `Tournament Created`
- Helper text: `Your tournament has been created with the selected settings.`
- Summary block:
  - `Name:` selected tournament name
  - `Description:` selected description when present
  - `Format:` selected format
  - `Deck verification:` selected verification setting
  - `Submitted players:` selected submission display setting
- Follow-up line: `Open the thread to start collecting deck submissions.`

### Tournament Thread Summary

- Title: selected tournament name
- Body:
  - selected description when present
  - `Format: [selected format]`
  - `[count] players submitted`
  - `Submitted players` section only when public names are enabled
- Public submitted-player names should be rendered as a line-separated list or table.
- The submitted-player section should be structured so later publish updates can extend it with additional columns naturally.
- The future published column order should start with `Placement | Player | ...`, and published rows should sort by placement when present.

### Tournament Post Instructions

- Section title: `How to Enter`
- Body:
  - `Use /submit in this thread to enter the tournament.`
  - `You’ll get a direct message to submit your deck.`
  - `If you need to make changes, run /submit again to update your entry.`

### Future Publish Flow: Result Entry Mode

- Title: `Publish Results`
- Helper text: `Choose how you want to add tournament results.`
- Field label: `Result entry mode`
- Options:
  - `Publish decklists without Standings`
  - `Enter placements`
  - `Enter records and calculate placement`

### Future Publish Flow: Republish Target

- Title: `Republish Post`
- Helper text: `Choose whether to update the existing published post or create a new one.`
- Options:
  - `Update Existing Post`
  - `Create New Post`

### Future Publish Flow: Deck Archetypes

- Title: `Deck Archetypes`
- Helper text: `Choose whether to include an archetype for each published deck.`
- Field label: `Archetype entry`
- Options:
  - `Do not include archetypes`
  - `Include archetypes for all decks`

### Future Published Tournament View

- The published tournament post should always include every submitted player's decklist.
- Result data such as placement or record should enhance each player's published entry, not replace the deck information.
- When result columns are present, they should lead with `Placement | Player | ...`, but the deck name and decklist should still be shown as part of that player's published block.
- The default compact published layout should be `Placement | Player | Record | Deck` when the decklist is a clean external URL that fits naturally in a row.
- If the organizer skips results entirely, the published view should omit result columns and list players alphabetically.
- Published player names should always be visible once a tournament is published.
- Publish flow may optionally require an `Archetype` value for every deck and include it in the published layout.
- The deck column should include the deck name together with the decklist value.
- When a decklist is a simple external URL and it fits cleanly, the published view should prefer showing it inline in the deck column.
- The published layout should still support a fallback block-style deck presentation for multiline text decklists or long values that do not fit naturally in a compact row.

### Future Submission Flow: Player Name

- Title: `Player Name`
- Helper text: `Choose the player name for this deck submission.`
- Primary button: `Use "[current name]"`
- Secondary button: `Submit Under Another Name`
- Alternate-name flow:
  - prompt for a freeform player name
  - continue the rest of submission the same way for custom self names or another player

### Future Submission Flow: Deck Name

- Title: `Deck Name`
- Helper text: `Enter a name for this deck.`
- Field label: `Deck name`
- Placeholder: `Izzet Phoenix`, `Mono-Green Devotion`, `Jeskai Control`

### Future Submission Flow: Decklist

- Title: `Decklist`
- Helper text: `Paste the decklist, enter a deck URL, or upload an image.`
- Field label: `Decklist`
- Placeholder: `Paste a deck URL or full decklist here`
- Accepted inputs:
  - pasted deck text
  - deck URL
  - image upload
- Validation behavior:
  - accept any non-empty supported input
  - if verification is enabled later, run it silently after submission
  - if the user submits again, replace their previous deck name and deck entry for that player
- Image uploads should be compatible with later AI photo-reading support, but that processing is outside the scope of this change.

### Future Submission Flow: Submission Saved

- Title: `Submission Saved`
- Helper text: `Your deck submission has been saved.`
- Summary block:
  - `Player:` selected player name
  - `Deck:` selected deck name
  - `Deck entry:` submitted deck URL, uploaded image, or pasted decklist
  - `Verification:` shown only when verification fails
- Follow-up line: `Use /submit again in this thread to update your entry.`

### Future Submission Flow: Verification Failure

- Title: `Deck Verification Failed`
- Helper text: `The submitted deck could not be verified for the selected format. Update the deck entry and try again.`
- Summary block:
  - `Player:` selected player name
  - `Deck:` selected deck name
  - `Format:` selected tournament format
  - `Verification:` failure result
- Follow-up line: `Submit an updated decklist, deck URL, or image to continue.`

### Future Publish Flow: Player Review

- Title: `Player Review`
- Helper text: `Review the current submission and enter results for this player.`
- Summary block:
  - `Player:` selected player name
  - `Deck:` selected deck name
  - `Deck entry:` submitted deck URL, uploaded image, or pasted decklist
  - `Archetype:` current value when archetypes are enabled
  - `Placement:` current value when placements mode is active
  - `Record:` current value when records mode is active
- Prompt line:
  - placements mode: `Enter placement for this player.`
  - records mode: `Enter record for this player.`
  - archetype mode: `Enter archetype for this deck.`
