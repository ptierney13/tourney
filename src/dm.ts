import { ChannelType, type DMChannel, type Message, type User } from 'discord.js';

const RESPONSE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function normalizeFreeformText(content: string): string {
  return content.trim().replace(/\r\n/g, '\n').trim();
}

export async function openDm(user: User): Promise<DMChannel> {
  return user.createDM();
}

export async function promptForText(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  invalidPrompt: string;
  validate?: (value: string) => boolean;
}): Promise<string | null> {
  const validate = options.validate ?? ((value: string) => normalizeFreeformText(value).length > 0);

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

export async function promptForChoice(options: {
  channel: DMChannel;
  userId: string;
  prompt: string;
  choices: string[];
}): Promise<string | null> {
  const normalizedChoices = options.choices.map((choice) => choice.toLowerCase());

  return promptForText({
    channel: options.channel,
    userId: options.userId,
    prompt: options.prompt,
    invalidPrompt: `Please reply with one of: ${options.choices.join(', ')}`,
    validate: (value) => normalizedChoices.includes(value.toLowerCase())
  }).then((value) => value?.toLowerCase() ?? null);
}

async function awaitNextDmMessage(channel: DMChannel, userId: string): Promise<Message | null> {
  try {
    const collected = await channel.awaitMessages({
      filter: (message) =>
        message.author.id === userId &&
        message.channel.type === ChannelType.DM &&
        normalizeFreeformText(message.content).length > 0,
      max: 1,
      time: RESPONSE_TIMEOUT_MS,
      errors: ['time']
    });

    return collected.first() ?? null;
  } catch {
    await channel.send('Timed out waiting for your response. Please run the command again.');
    return null;
  }
}
