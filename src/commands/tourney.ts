import {
  ButtonStyle,
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel
} from 'discord.js';

import { loadConfig } from '../config';
import {
  openDm,
  promptForOptionalText,
  promptForText,
  promptWithButtons,
  promptWithSelect,
  renderFormText
} from '../dm';
import { syncPinnedStatusMessage } from '../messagePins';
import {
  buildOrganizerAccessToken,
  buildOrganizerStatusUrl,
  createOrganizerAccess
} from '../organizerAccess';
import { tournamentStore } from '../store';
import {
  buildTournament,
  buildTournamentThreadName,
  isFreeformFormat,
  renderTournamentThreadSummary
} from '../tournaments';
import type {
  SubmissionDisplayMode,
  TournamentFormat,
  TournamentSetupMode,
  TourneyCommand
} from '../types';
import { TOURNAMENT_FORMATS } from '../types';

const DEFAULT_TOURNAMENT_NAME = 'Community Tournament';
const config = loadConfig();

function canCreateThreads(
  channel: ChatInputCommandInteraction['channel']
): channel is TextChannel {
  return Boolean(channel && channel.type === ChannelType.GuildText);
}

export const tourneyCommand: TourneyCommand = {
  data: new SlashCommandBuilder()
    .setName('tourney')
    .setDescription('Create a tournament thread after a short DM setup.'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!canCreateThreads(interaction.channel)) {
      await interaction.editReply(
        'This command currently works in standard server text channels where I can create a thread.'
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

    await interaction.editReply('I sent you a DM to set up your tournament.');

    const setupMode = await promptWithButtons({
      channel: dmChannel,
      userId: interaction.user.id,
      title: 'Tournament Setup',
      helper:
        'Create the tournament with default settings, or customize the details.',
      choices: [
        {
          label: 'Use Default Settings',
          value: 'default',
          style: ButtonStyle.Primary
        },
        {
          label: 'Customize My Tournament',
          value: 'custom'
        }
      ]
    });

    if (!setupMode) {
      return;
    }

    const tournamentSettings =
      setupMode === 'default'
        ? getDefaultTournamentSettings()
        : await promptForTournamentSettings(dmChannel, interaction.user.id);

    if (!tournamentSettings) {
      return;
    }

    const threadName = buildTournamentThreadName(tournamentSettings.name);
    const thread = await interaction.channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: `Tournament created by ${interaction.user.username}`
    });
    const organizerCredentials = createOrganizerAccess();

    const tournament = buildTournament({
      ...tournamentSettings,
      setupMode: setupMode as TournamentSetupMode,
      creator: interaction.user,
      sourceChannelId: interaction.channel.id,
      threadId: thread.id,
      threadName,
      organizerAccess: organizerCredentials.organizerAccess
    });
    const organizerStatusUrl = buildOrganizerStatusUrl({
      baseUrl: config.organizerBaseUrl,
      tournamentId: tournament.id,
      accessToken: buildOrganizerAccessToken({
        tokenId: organizerCredentials.organizerAccess.tokenId,
        tokenSecret: organizerCredentials.tokenSecret
      })
    });

    const threadSummaryMessage = await thread.send(
      renderTournamentThreadSummary(tournament)
    );
    const threadSummaryPinResult = await syncPinnedStatusMessage({
      message: threadSummaryMessage
    });
    tournament.threadSummaryMessageId = threadSummaryMessage.id;

    await tournamentStore.createTournament(tournament);

    await dmChannel.send(
      setupMode === 'default'
        ? [
            '**Tournament Created**',
            'Community Tournament was created with default settings. Player names will stay hidden, and the thread summary will show players submitted.',
            `Organizer status page: <${organizerStatusUrl}>`,
            'Anyone with the full link can access and edit this tournament.',
            'Open the thread to start collecting deck submissions.',
            threadSummaryPinResult.warning
          ]
            .filter(Boolean)
            .join('\n\n')
        : renderDetailedSetupResult(tournament, organizerStatusUrl)
    );

    if (setupMode !== 'default' && threadSummaryPinResult.warning) {
      await dmChannel.send(threadSummaryPinResult.warning);
    }

    await interaction.editReply(
      `Tournament created. Head to <#${thread.id}> to collect submissions.`
    );
  }
};

async function promptForTournamentSettings(
  dmChannel: Awaited<ReturnType<typeof openDm>>,
  userId: string
): Promise<{
  name: string;
  description: string | null;
  format: TournamentFormat;
  requireDeckVerification: boolean;
  submissionDisplayMode: SubmissionDisplayMode;
} | null> {
  const name = await promptForText({
    channel: dmChannel,
    userId,
    prompt: renderFormText('Tournament Name', 'Choose the name for your tournament.'),
    invalidPrompt: 'Please send a non-empty tournament name.'
  });

  if (!name) {
    return null;
  }

  const description = await promptForOptionalText({
    channel: dmChannel,
    userId,
    prompt: renderFormText(
      'Tournament Description',
      'Add an optional description for your tournament that will be posted in the tournament summary.'
    ),
    skipValue: 'skip'
  });

  const formatValue = await promptWithSelect({
    channel: dmChannel,
    userId,
    title: 'Tournament Format',
    helper: 'Select a format for this tournament.',
    fieldLabel: 'Format',
    placeholder: 'Choose a format',
    choices: TOURNAMENT_FORMATS.map((format) => ({
      label: format,
      value: format
    }))
  });

  if (!formatValue) {
    return null;
  }

  const format = formatValue as TournamentFormat;
  let requireDeckVerification = false;

  if (!isFreeformFormat(format)) {
    const verificationChoice = await promptWithButtons({
      channel: dmChannel,
      userId,
      title: 'Deck Verification',
      helper:
        'Choose whether submitted decks should be checked against the selected format.',
      choices: [
        {
          label: 'Yes, verify decks',
          value: 'yes',
          style: ButtonStyle.Primary
        },
        {
          label: 'No verification',
          value: 'no'
        }
      ]
    });

    if (!verificationChoice) {
      return null;
    }

    requireDeckVerification = verificationChoice === 'yes';
  }

  const submissionDisplayChoice = await promptWithButtons({
    channel: dmChannel,
    userId,
    title: 'Submitted Players',
    helper:
      'Choose whether the tournament summary shows only the number of players submitted, or also their names.',
    choices: [
      {
        label: 'Count Only',
        value: 'count-only',
        style: ButtonStyle.Primary
      },
      {
        label: 'Count and Player Names',
        value: 'count-plus-names'
      }
    ]
  });

  if (!submissionDisplayChoice) {
    return null;
  }

  return {
    name,
    description,
    format,
    requireDeckVerification,
    submissionDisplayMode: submissionDisplayChoice as SubmissionDisplayMode
  };
}

function getDefaultTournamentSettings(): {
  name: string;
  description: string | null;
  format: TournamentFormat;
  requireDeckVerification: boolean;
  submissionDisplayMode: SubmissionDisplayMode;
} {
  return {
    name: DEFAULT_TOURNAMENT_NAME,
    description: null,
    format: 'Freeform',
    requireDeckVerification: false,
    submissionDisplayMode: 'count-only'
  };
}

function renderDetailedSetupResult(
  tournament: ReturnType<typeof buildTournament>,
  organizerStatusUrl: string
): string {
  const lines = [
    '**Tournament Created**',
    'Your tournament has been created with the selected settings.',
    `Name: ${tournament.name}`
  ];

  if (tournament.description) {
    lines.push(`Description: ${tournament.description}`);
  }

  lines.push(`Format: ${tournament.format}`);
  lines.push(
    `Deck verification: ${tournament.requireDeckVerification ? 'Yes, verify decks' : 'No verification'}`
  );
  lines.push(
    `Submitted players: ${
      tournament.submissionDisplayMode === 'count-plus-names'
        ? 'Count and player names'
        : 'Count only'
    }`
  );
  lines.push('');
  lines.push(`Organizer status page: <${organizerStatusUrl}>`);
  lines.push('Anyone with the full link can access and edit this tournament.');
  lines.push('');
  lines.push('Open the thread to start collecting deck submissions.');

  return lines.join('\n');
}
