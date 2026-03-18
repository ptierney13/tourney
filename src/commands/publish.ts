import {
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';

import {
  openDm,
  promptForText,
  promptWithButtons,
  renderFormText
} from '../dm';
import { syncPinnedStatusMessage } from '../messagePins';
import { tournamentStore } from '../store';
import {
  applyCalculatedPlacements,
  isValidTournamentRecord,
  renderPublishedTournamentSummary
} from '../tournaments';
import type {
  PublishResultMode,
  Tournament,
  TournamentSubmission,
  TourneyCommand
} from '../types';

export const publishCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('publish')
    .setDescription(
      'Publish or update the tournament summary for this thread.'
    ),
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

    if (tournament.creatorUserId !== interaction.user.id) {
      await interaction.editReply(
        'Only the tournament creator can publish this thread.'
      );
      return;
    }

    const submissions = await tournamentStore.listSubmissions(
      interaction.channel.id
    );

    if (submissions.length === 0) {
      await interaction.editReply(
        'There are no deck submissions to publish yet.'
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
      'I sent you a DM to walk through tournament publishing.'
    );

    const resultModeValue = await promptWithButtons({
      channel: dmChannel,
      userId: interaction.user.id,
      title: 'Publish Results',
      helper: 'Choose how you want to add tournament results.',
      choices: [
        {
          label: 'Publish decklists without Standings',
          value: 'none',
          style: ButtonStyle.Primary
        },
        {
          label: 'Enter placements',
          value: 'placement'
        },
        {
          label: 'Enter records and calculate placement',
          value: 'record'
        }
      ]
    });

    if (!resultModeValue) {
      return;
    }

    const resultMode = resultModeValue as PublishResultMode;
    const includeArchetypes =
      resultMode === 'none'
        ? false
        : (await promptWithButtons({
            channel: dmChannel,
            userId: interaction.user.id,
            title: 'Deck Archetypes',
            helper:
              'Choose whether to include an archetype for each published deck.',
            choices: [
              {
                label: 'Do not include archetypes',
                value: 'no',
                style: ButtonStyle.Primary
              },
              {
                label: 'Include archetypes for all decks',
                value: 'yes'
              }
            ]
          })) === 'yes';

    const workingTournament = cloneTournament(tournament);
    const workingSubmissions = Object.values(
      workingTournament.submissions
    ).sort((left, right) => left.playerName.localeCompare(right.playerName));

    resetPublishedFields(workingSubmissions, {
      resultMode,
      includeArchetypes
    });

    if (resultMode !== 'none' || includeArchetypes) {
      for (const submission of workingSubmissions) {
        if (resultMode === 'placement') {
          const placementText = await promptForText({
            channel: dmChannel,
            userId: interaction.user.id,
            prompt: renderPlayerReviewPrompt(submission, {
              mode: 'placement'
            }),
            invalidPrompt:
              'Please enter a placement number or reply with `skip`.'
          });

          if (!placementText) {
            return;
          }

          submission.placementText =
            placementText.toLowerCase() === 'skip'
              ? null
              : formatPlacementValue(placementText);
        }

        if (resultMode === 'record') {
          const recordText = await promptForText({
            channel: dmChannel,
            userId: interaction.user.id,
            prompt: renderPlayerReviewPrompt(submission, {
              mode: 'record'
            }),
            invalidPrompt: 'Please enter a record in `W-L` or `W-L-D` format.',
            validate: (value) => isValidTournamentRecord(value)
          });

          if (!recordText) {
            return;
          }

          submission.recordText = recordText;
        }

        if (includeArchetypes) {
          const archetype = await promptForText({
            channel: dmChannel,
            userId: interaction.user.id,
            prompt: renderPlayerReviewPrompt(submission, {
              mode: 'archetype'
            }),
            invalidPrompt: 'Please enter a non-empty archetype value.'
          });

          if (!archetype) {
            return;
          }

          submission.archetype = archetype;
        }
      }
    }

    if (resultMode === 'record') {
      applyCalculatedPlacements(workingSubmissions);
    }

    for (const submission of workingSubmissions) {
      workingTournament.submissions[submission.normalizedPlayerName] =
        submission;
    }

    const content = renderPublishedTournamentSummary(workingTournament);
    let publishedMessageId = workingTournament.publishedMessageId;
    let publishTarget: 'update-existing' | 'create-new' = 'update-existing';
    let pinWarning: string | null = null;

    if (publishedMessageId) {
      const publishTargetChoice = await promptWithButtons({
        channel: dmChannel,
        userId: interaction.user.id,
        title: 'Republish Post',
        helper:
          'Choose whether to update the existing published post or create a new one.',
        choices: [
          {
            label: 'Update Existing Post',
            value: 'update-existing',
            style: ButtonStyle.Primary
          },
          {
            label: 'Create New Post',
            value: 'create-new'
          }
        ]
      });

      if (!publishTargetChoice) {
        return;
      }

      publishTarget = publishTargetChoice as 'update-existing' | 'create-new';
    }

    if (publishedMessageId && publishTarget === 'update-existing') {
      try {
        const existingMessage =
          await interaction.channel.messages.fetch(publishedMessageId);
        await existingMessage.edit(content);
        const pinResult = await syncPinnedStatusMessage({
          message: existingMessage
        });
        pinWarning = pinResult.warning;
      } catch {
        const newMessage = await interaction.channel.send(content);
        const pinResult = await syncPinnedStatusMessage({
          message: newMessage,
          previousPinnedMessageId: publishedMessageId
        });
        pinWarning = pinResult.warning;
        publishedMessageId = newMessage.id;
        publishTarget = 'create-new';
      }
    } else {
      const newMessage = await interaction.channel.send(content);
      const pinResult = await syncPinnedStatusMessage({
        message: newMessage,
        previousPinnedMessageId: workingTournament.publishedMessageId
      });
      pinWarning = pinResult.warning;
      publishedMessageId = newMessage.id;
    }

    workingTournament.publishedMessageId = publishedMessageId;
    workingTournament.publishedAt = new Date().toISOString();
    await tournamentStore.saveTournament(workingTournament);

    await dmChannel.send(
      [
        publishTarget === 'create-new'
          ? `Published the tournament summary in <#${interaction.channel.id}> with a new post.`
          : `Updated the published tournament summary in <#${interaction.channel.id}>.`,
        pinWarning
      ]
        .filter(Boolean)
        .join('\n\n')
    );
  }
};

function cloneTournament(tournament: Tournament): Tournament {
  return JSON.parse(JSON.stringify(tournament)) as Tournament;
}

function resetPublishedFields(
  submissions: TournamentSubmission[],
  options: {
    resultMode: PublishResultMode;
    includeArchetypes: boolean;
  }
): void {
  for (const submission of submissions) {
    if (options.resultMode === 'none') {
      submission.placementText = null;
      submission.recordText = null;
    } else if (options.resultMode === 'placement') {
      submission.placementText = null;
      submission.recordText = null;
    } else if (options.resultMode === 'record') {
      submission.placementText = null;
      submission.recordText = null;
    }

    if (!options.includeArchetypes) {
      submission.archetype = null;
    }
  }
}

function renderPlayerReviewPrompt(
  submission: TournamentSubmission,
  options: {
    mode: 'placement' | 'record' | 'archetype';
  }
): string {
  const summaryLines = [
    `Player: ${submission.playerName}`,
    `Deck name: ${submission.deckName}`,
    `Deck:\n${formatDeckEntrySummary(submission)}`
  ];

  if (submission.archetype) {
    summaryLines.push(`Archetype: ${submission.archetype}`);
  }

  if (submission.placementText) {
    summaryLines.push(`Placement: ${submission.placementText}`);
  }

  if (submission.recordText) {
    summaryLines.push(`Record: ${submission.recordText}`);
  }

  if (options.mode === 'placement') {
    summaryLines.push(
      'Enter placement for this player. Reply with `skip` to leave it blank.'
    );
  }

  if (options.mode === 'record') {
    summaryLines.push('Enter record for this player.');
  }

  if (options.mode === 'archetype') {
    summaryLines.push('Enter archetype for this deck.');
  }

  return renderFormText(
    'Player Review',
    'Review the current submission and enter results for this player.',
    summaryLines
  );
}

function formatDeckEntrySummary(submission: TournamentSubmission): string {
  if (submission.decklistType === 'url') {
    return `<${submission.decklist}>`;
  }

  if (submission.decklistType === 'image') {
    return `Image uploaded: <${submission.decklist}>`;
  }

  return submission.decklist;
}

function formatPlacementValue(value: string): string {
  const trimmed = value.trim();
  const numericMatch = trimmed.match(/^(\d+)$/);

  if (!numericMatch) {
    return trimmed;
  }

  const numericValue = Number(numericMatch[1]);
  const tens = numericValue % 100;

  if (tens >= 11 && tens <= 13) {
    return `${numericValue}th`;
  }

  switch (numericValue % 10) {
    case 1:
      return `${numericValue}st`;
    case 2:
      return `${numericValue}nd`;
    case 3:
      return `${numericValue}rd`;
    default:
      return `${numericValue}th`;
  }
}
