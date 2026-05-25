import { Client, Events, MessageFlags } from 'discord.js';
import { logger } from '../logger.js';
import { getCommandMap } from './registry.js';

export function registerInteractions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      const cmd = getCommandMap().get(interaction.commandName);
      if (!cmd?.autocomplete) return;
      try {
        await cmd.autocomplete(interaction);
      } catch (err) {
        logger.error(`Autocomplete error for /${interaction.commandName}:`, err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const tag = interaction.user.tag;
    const guild = interaction.guild?.name ?? 'DM';
    const guildId = interaction.guildId ?? 'DM';
    logger.info(`/${interaction.commandName} invoked by ${tag} in "${guild}" (${guildId})`);
    logger.debug(`/${interaction.commandName} options:`, interaction.options.data);

    const command = getCommandMap().get(interaction.commandName);
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
