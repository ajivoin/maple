import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import { logger } from '../logger.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('save')
    .setDescription('DM yourself the link to the currently playing track.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    const current = player?.currentTrack();
    if (!current) {
      await interaction.reply({
        content: 'Nothing is playing right now.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.user.send(`Saved track: **${current.title}**\n${current.url}`);
      await interaction.reply({
        content: 'Sent to your DMs.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.warn(`Failed to DM ${interaction.user.id}:`, err);
      await interaction.reply({
        content: `Could not DM you — here is the link:\n${current.url}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
