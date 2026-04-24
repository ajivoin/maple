import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands/index.js';
import { config, isProduction } from '../src/config.js';
import { logger } from '../src/logger.js';

async function main() {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const body = commands.map((c) => c.data.toJSON());

  if (isProduction) {
    logger.info(`Registering ${body.length} global commands...`);
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body });
    logger.info('Global commands registered. Propagation can take up to an hour.');
    return;
  }

  if (!config.DEV_GUILD_ID) {
    throw new Error('DEV_GUILD_ID must be set when NODE_ENV is not production.');
  }

  logger.info(`Registering ${body.length} guild commands in ${config.DEV_GUILD_ID}...`);
  await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.DEV_GUILD_ID), { body });
  logger.info('Guild commands registered.');
}

main().catch((err) => {
  logger.error('Command deployment failed:', err);
  process.exit(1);
});
