import { Client, Events, MessageFlags } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { logger } from '../logger.js';

export function registerInteractions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Error in /${interaction.commandName}:`, err);
      const reply = {
        content: 'Something went wrong running that command.',
        flags: MessageFlags.Ephemeral,
      } as const;
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyErr) {
        logger.error('Failed to send error reply:', replyErr);
      }
    }
  });
}
