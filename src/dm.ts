import { randomUUID } from 'node:crypto';

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  StringSelectMenuBuilder,
  type DMChannel,
  type Message,
  type User
} from 'discord.js';

import type { DeckEntryType } from './types';

const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const FORM_SEPARATOR = '\n\n';

type ButtonChoice = {
  label: string;
  value: string;
  style?: ButtonStyle;
};

type SelectChoice = {
  label: string;
  value: string;
  description?: string;
};

export function normalizeFreeformText(content: string): string {
  return content.trim().replace(/\r\n/g, '\n').trim();
}

export function openDm(user: User): Promise<DMChannel> {
  return user.createDM();
}

export async function promptForText(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  invalidPrompt: string;
  validate?: (value: string) => boolean;
}): Promise<string | null> {
  const validate =
    options.validate ??
    ((value: string) => normalizeFreeformText(value).length > 0);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await options.channel.send(options.prompt);

    const reply = await awaitNextDmMessage(options.channel, options.userId);

    if (!reply) {
      return null;
    }

    const value = normalizeFreeformText(reply.content);

    if (validate(value)) {
      return value;
    }

    await options.channel.send(options.invalidPrompt);
  }

  return null;
}

export function promptForChoice(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  choices: string[];
}): Promise<string | null> {
  const normalizedChoices = options.choices.map((choice) =>
    choice.toLowerCase()
  );

  return promptForText({
    channel: options.channel,
    userId: options.userId,
    prompt: options.prompt,
    invalidPrompt: `Please reply with one of: ${options.choices.join(', ')}`,
    validate: (value) => normalizedChoices.includes(value.toLowerCase())
  }).then((value) => value?.toLowerCase() ?? null);
}

export function promptForOptionalText(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  skipValue: string;
}): Promise<string | null> {
  const normalizedSkipValue = options.skipValue.toLowerCase();

  return promptForText({
    channel: options.channel,
    userId: options.userId,
    prompt: `${options.prompt}\n\nReply with \`${options.skipValue}\` to leave this blank.`,
    invalidPrompt: `Please send a response or reply with \`${options.skipValue}\`.`
  }).then((value) => {
    if (!value) {
      return null;
    }

    return value.toLowerCase() === normalizedSkipValue ? null : value;
  });
}

export async function promptWithButtons(options: {
  channel: DMChannel;
  userId: string;
  title: string;
  helper: string;
  choices: ButtonChoice[];
}): Promise<string | null> {
  const promptText = renderFormText(options.title, options.helper);
  const nonce = randomUUID();
  const choiceMap = new Map<string, ButtonChoice>();
  const rows = chunkArray(
    options.choices.map((choice, index) => {
      const customId = `${nonce}:${index}`;
      choiceMap.set(customId, choice);

      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(choice.label)
        .setStyle(choice.style ?? ButtonStyle.Secondary);
    }),
    5
  ).map((buttons) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
  );

  const message = await options.channel.send({
    content: promptText,
    components: rows
  });

  try {
    const interaction = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: RESPONSE_TIMEOUT_MS,
      filter: (componentInteraction) =>
        componentInteraction.user.id === options.userId
    });
    const choice = choiceMap.get(interaction.customId);

    await interaction.update({
      content: renderFormText(options.title, options.helper, [
        `Selected: ${choice?.label ?? 'Unknown'}`
      ]),
      components: []
    });

    return choice?.value ?? null;
  } catch {
    await options.channel.send(
      'Timed out waiting for your response. Please run the command again.'
    );
    return null;
  }
}

export async function promptWithSelect(options: {
  channel: DMChannel;
  userId: string;
  title: string;
  helper: string;
  fieldLabel: string;
  placeholder: string;
  choices: SelectChoice[];
}): Promise<string | null> {
  const promptText = renderFormText(options.title, options.helper);
  const nonce = randomUUID();
  const choiceMap = new Map(
    options.choices.map((choice) => [choice.value, choice])
  );
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${nonce}:select`)
    .setPlaceholder(options.placeholder)
    .addOptions(
      options.choices.map((choice) => ({
        label: choice.label,
        value: choice.value,
        description: choice.description
      }))
    );

  const message = await options.channel.send({
    content: promptText,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
    ]
  });

  try {
    const interaction = await message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: RESPONSE_TIMEOUT_MS,
      filter: (componentInteraction) =>
        componentInteraction.user.id === options.userId
    });
    const selectedValue = interaction.values[0];
    const choice = choiceMap.get(selectedValue);

    await interaction.update({
      content: renderFormText(options.title, options.helper, [
        `${options.fieldLabel}: ${choice?.label ?? selectedValue}`
      ]),
      components: []
    });

    return selectedValue;
  } catch {
    await options.channel.send(
      'Timed out waiting for your response. Please run the command again.'
    );
    return null;
  }
}

export async function promptForDeckEntry(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  invalidPrompt: string;
}): Promise<{ decklist: string; decklistType: DeckEntryType } | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await options.channel.send(options.prompt);

    const reply = await awaitNextDmMessage(options.channel, options.userId, {
      allowAttachments: true
    });

    if (!reply) {
      return null;
    }

    const parsedEntry = parseDeckEntry(reply);

    if (parsedEntry) {
      return parsedEntry;
    }

    await options.channel.send(options.invalidPrompt);
  }

  return null;
}

export function renderFormText(
  title: string,
  helper: string,
  extraLines: string[] = []
): string {
  return [`**${title}**`, helper, ...extraLines]
    .filter(Boolean)
    .join(FORM_SEPARATOR);
}

async function awaitNextDmMessage(
  channel: DMChannel,
  userId: string,
  options: {
    allowAttachments?: boolean;
  } = {}
): Promise<Message | null> {
  try {
    const collected = await channel.awaitMessages({
      filter: (message) => {
        if (
          message.author.id !== userId ||
          message.channel.type !== ChannelType.DM
        ) {
          return false;
        }

        if (normalizeFreeformText(message.content).length > 0) {
          return true;
        }

        return Boolean(
          options.allowAttachments && message.attachments.size > 0
        );
      },
      max: 1,
      time: RESPONSE_TIMEOUT_MS,
      errors: ['time']
    });

    return collected.first() ?? null;
  } catch {
    await channel.send(
      'Timed out waiting for your response. Please run the command again.'
    );
    return null;
  }
}

function parseDeckEntry(
  message: Message
): { decklist: string; decklistType: DeckEntryType } | null {
  const normalizedContent = normalizeFreeformText(message.content);

  if (normalizedContent.length > 0) {
    return {
      decklist: normalizedContent,
      decklistType: /^https?:\/\/\S+$/i.test(normalizedContent) ? 'url' : 'text'
    };
  }

  const attachment = message.attachments.first();

  if (!attachment) {
    return null;
  }

  const contentType = attachment.contentType?.toLowerCase() ?? '';
  const fileName = attachment.name?.toLowerCase() ?? '';
  const isImage =
    contentType.startsWith('image/') ||
    ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some((suffix) =>
      fileName.endsWith(suffix)
    );

  if (!isImage) {
    return null;
  }

  return {
    decklist: attachment.url,
    decklistType: 'image'
  };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
