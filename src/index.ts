import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { deployCommands } from './deploy-commands.js';
import { registerInteractions } from './events/interactionCreate.js';
import { registerReady } from './events/ready.js';
import { registerVoiceStateUpdate } from './events/voiceStateUpdate.js';
import { logger } from './logger.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

registerReady(client);
registerInteractions(client);
registerVoiceStateUpdate(client);

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down.`);
  client.destroy().finally(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await deployCommands();
} catch (err) {
  logger.error('Command deployment failed, continuing with existing registration:', err);
}

client.login(config.DISCORD_TOKEN).catch((err) => {
  logger.error('Login failed:', err);
  process.exit(1);
});
