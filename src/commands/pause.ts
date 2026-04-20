import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume the current track.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    if (!player) {
      await interaction.reply({
        content: 'Nothing is playing right now.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = player.pauseToggle();
    if (result === 'paused') {
      await interaction.reply('Paused.');
    } else if (result === 'resumed') {
      await interaction.reply('Resumed.');
    } else {
      await interaction.reply({
        content: 'Nothing is playing right now.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
