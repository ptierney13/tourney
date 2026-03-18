import {
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';

import {
  openDm,
  promptForDeckEntry,
  promptForText,
  promptWithButtons,
  renderFormText
} from '../dm';
import { syncPinnedStatusMessage } from '../messagePins';
import { tournamentStore } from '../store';
import {
  buildTournamentSubmission,
  getDefaultPlayerName,
  renderTournamentThreadSummary
} from '../tournaments';
import type { TourneyCommand } from '../types';

export const submitCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit or update a decklist for this tournament thread.'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.channel?.isThread()) {
      await interaction.editReply(
        'This command only works inside a Tourney-created thread.'
      );
      return;
    }

    const tournament = await tournamentStore.getTournamentByThreadId(
      interaction.channel.id
    );

    if (!tournament) {
      await interaction.editReply(
        'This thread is not registered as a tournament thread.'
      );
      return;
    }

    let dmChannel;

    try {
      dmChannel = await openDm(interaction.user);
    } catch {
      await interaction.editReply(
        'I could not open a DM with you. Please enable direct messages and try again.'
      );
      return;
    }

    await interaction.editReply(
      'I sent you a DM to collect the deck submission for this tournament.'
    );

    const defaultPlayerName = getDefaultPlayerName(interaction.user);
    const playerNameChoice = await promptWithButtons({
      channel: dmChannel,
      userId: interaction.user.id,
      title: 'Player Name',
      helper: 'Choose the player name for this deck submission.',
      choices: [
        {
          label: `Use "${defaultPlayerName}"`,
          value: 'default-name',
          style: ButtonStyle.Primary
        },
        {
          label: 'Submit Under Another Name',
          value: 'custom-name'
        }
      ]
    });

    if (!playerNameChoice) {
      return;
    }

    const playerName =
      playerNameChoice === 'default-name'
        ? defaultPlayerName
        : await promptForText({
            channel: dmChannel,
            userId: interaction.user.id,
            prompt: renderFormText('Player Name', 'Choose the player name for this deck submission.'),
            invalidPrompt: 'Please send a non-empty player name.'
          });

    if (!playerName) {
      return;
    }

    const deckName = await promptForText({
      channel: dmChannel,
      userId: interaction.user.id,
      prompt: renderFormText('Deck Name', 'Enter a name for this deck.'),
      invalidPrompt: 'Please send a non-empty deck name.'
    });

    if (!deckName) {
      return;
    }

    let deckEntry: {
      decklist: string;
      decklistType: 'text' | 'url' | 'image';
    } | null = null;

    while (!deckEntry) {
      const nextDeckEntry = await promptForDeckEntry({
        channel: dmChannel,
        userId: interaction.user.id,
        prompt: renderFormText(
          'Decklist',
          'Paste the decklist, enter a deck URL, or upload an image.'
        ),
        invalidPrompt:
          'Please send a deck URL, a non-empty decklist, or an image upload.'
      });

      if (!nextDeckEntry) {
        return;
      }

      const verificationFailure = await maybeVerifyDeckSubmission({
        tournamentFormat: tournament.format,
        requireDeckVerification: tournament.requireDeckVerification,
        deckEntry: nextDeckEntry
      });

      if (!verificationFailure) {
        deckEntry = nextDeckEntry;
        break;
      }

      await dmChannel.send(
        [
          '**Deck Verification Failed**',
          'The submitted deck could not be verified for the selected format. Update the deck entry and try again.',
          `Player: ${playerName}`,
          `Deck name: ${deckName}`,
          `Deck:\n${formatDeckEntrySummary(nextDeckEntry.decklist, nextDeckEntry.decklistType)}`,
          `Format: ${tournament.format}`,
          `Verification: ${verificationFailure}`,
          '',
          'Submit an updated decklist, deck URL, or image to continue.'
        ].join('\n')
      );
    }

    const submission = buildTournamentSubmission({
      playerName,
      deckName,
      decklist: deckEntry.decklist,
      decklistType: deckEntry.decklistType,
      submitter: interaction.user
    });

    const updatedTournament = await tournamentStore.upsertSubmission({
      threadId: interaction.channel.id,
      submission
    });

    if (!updatedTournament) {
      await dmChannel.send(
        'Something went wrong while saving your submission.'
      );
      return;
    }

    await syncThreadSummaryMessage(updatedTournament, interaction.channel);

    await dmChannel.send(
      [
        '**Submission Saved**',
        'Your deck submission has been saved.',
        `Player: ${submission.playerName}`,
        `Deck name: ${submission.deckName}`,
        `Deck:\n${formatDeckEntrySummary(submission.decklist, submission.decklistType)}`,
        '',
        'Use /submit again from the tournament thread to update your entry.'
      ].join('\n')
    );
  }
};

async function maybeVerifyDeckSubmission(options: {
  tournamentFormat: string;
  requireDeckVerification: boolean;
  deckEntry: {
    decklist: string;
    decklistType: 'text' | 'url' | 'image';
  };
}): Promise<string | null> {
  if (!options.requireDeckVerification) {
    return null;
  }

  // Format-aware deck verification is intentionally deferred to future work.
  return null;
}

async function syncThreadSummaryMessage(
  tournament: Awaited<
    ReturnType<typeof tournamentStore.getTournamentByThreadId>
  > extends infer T
    ? T extends null
      ? never
      : T
    : never,
  thread: NonNullable<ChatInputCommandInteraction['channel']>
): Promise<void> {
  if (!thread.isThread()) {
    return;
  }

  const content = renderTournamentThreadSummary(tournament);

  if (tournament.threadSummaryMessageId) {
    try {
      const existingMessage = await thread.messages.fetch(
        tournament.threadSummaryMessageId
      );
      await existingMessage.edit(content);
      await syncPinnedStatusMessage({
        message: existingMessage
      });
      return;
    } catch {
      // Fall through to recreate the message if the original summary can no longer be fetched.
    }
  }

  const message = await thread.send(content);
  await syncPinnedStatusMessage({
    message,
    previousPinnedMessageId: tournament.threadSummaryMessageId
  });
  tournament.threadSummaryMessageId = message.id;
  await tournamentStore.saveTournament(tournament);
}

function formatDeckEntrySummary(
  decklist: string,
  decklistType: 'text' | 'url' | 'image'
): string {
  if (decklistType === 'url') {
    return `<${decklist}>`;
  }

  if (decklistType === 'image') {
    return `Image uploaded: <${decklist}>`;
  }

  return decklist;
}
