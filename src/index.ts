import { Client } from 'discord.js';
import { initDb } from './db/index.js';
import { loadModules } from './core/loader.js';
import { registerInteractions } from './core/interactionCreate.js';
import { registerReady } from './core/ready.js';
import { AudioModule } from './modules/audio/index.js';
import { RssModule } from './modules/rss/index.js';
import { GeneralModule } from './modules/general/index.js';
import { config } from './config.js';
import { logger } from './logger.js';

initDb();

const { intents, registerEvents, onReady } = loadModules([AudioModule, RssModule, GeneralModule]);

const client = new Client({ intents });

registerEvents(client);
registerInteractions(client);
registerReady(client, onReady);

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);
  client.destroy().finally(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.DISCORD_TOKEN).catch((err) => {
  logger.error('Login failed:', err);
  process.exit(1);
});
