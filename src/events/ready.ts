import { Client, Events } from 'discord.js';
import { logger } from '../logger.js';

export function registerReady(client: Client): void {
  client.once(Events.ClientReady, (c) => {
    logger.info(`Logged in as ${c.user.tag} (${c.user.id})`);
  });
}
