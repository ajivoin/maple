import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rewind')
    .setDescription('Restart the current track from the beginning.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    const current = player?.currentTrack();
    if (!player || !current) {
      await interaction.reply({
        content: 'Nothing to rewind.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply();
    await player.rewind();
    await interaction.editReply(`Restarted **${current.title}**.`);
  },
};

export default command;
