import { REST, Routes } from 'discord.js';
import { loadModules } from '../src/core/loader.js';
import { getAllCommands } from '../src/core/registry.js';
import { AudioModule } from '../src/modules/audio/index.js';
import { RssModule } from '../src/modules/rss/index.js';
import { LetterboxdModule } from '../src/modules/letterboxd/index.js';
import { GeneralModule } from '../src/modules/general/index.js';
import { config, isProduction } from '../src/config.js';
import { logger } from '../src/logger.js';

loadModules([AudioModule, RssModule, LetterboxdModule, GeneralModule]);

async function main() {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const body = getAllCommands().map((c) => c.data.toJSON());

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
