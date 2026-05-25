import { ActivityType, Client, Events } from 'discord.js';
import { logger } from '../logger.js';

export function registerReady(client: Client, onReady: (client: Client) => Promise<void>): void {
  client.once(Events.ClientReady, async (c) => {
    logger.info(`Logged in as ${c.user.tag} (${c.user.id})`);
    c.user.setActivity('/help', { type: ActivityType.Listening });
    await onReady(c);
  });
}
