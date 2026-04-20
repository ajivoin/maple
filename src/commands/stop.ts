import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear the queue, and disconnect.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    if (!player) {
      await interaction.reply({
        content: 'Nothing to stop.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    player.stop();
    await interaction.reply('Stopped and disconnected.');
  },
};

export default command;
