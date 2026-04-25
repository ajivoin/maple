import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { config, isProduction } from './config.js';
import { logger } from './logger.js';

type CommandLike = { name: string; description: string; options?: unknown[] };

function commandsSignature(cmds: CommandLike[]): string {
  return JSON.stringify(
    cmds
      .map(({ name, description, options = [] }) => ({ name, description, options }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const desired = commands.map((c) => c.data.toJSON());

  if (!isProduction) {
    if (!config.DEV_GUILD_ID) {
      logger.warn('Skipping command deployment: DEV_GUILD_ID not set.');
      return;
    }
    await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.DEV_GUILD_ID), {
      body: desired,
    });
    logger.info(`Guild commands registered in ${config.DEV_GUILD_ID}.`);
    return;
  }

  const current = (await rest.get(Routes.applicationCommands(config.CLIENT_ID))) as CommandLike[];

  if (commandsSignature(current) === commandsSignature(desired)) {
    logger.info('Global commands unchanged, skipping deployment.');
    return;
  }

  logger.info(`Registering ${desired.length} global commands...`);
  await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: desired });
  logger.info('Global commands registered. Propagation can take up to an hour.');
}
