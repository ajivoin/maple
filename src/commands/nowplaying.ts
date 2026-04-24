import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';
import { formatDuration } from '../util.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    const track = player?.currentTrack();

    if (!player || !track) {
      await interaction.reply({
        content: 'Nothing is playing right now.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const statusLabel = player.playerStatus() === 'paused' ? '⏸ Paused' : '▶ Playing';
    const loopMode = player.getLoopMode();

    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing')
      .setColor(0xe6892f)
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Status', value: statusLabel, inline: true },
        { name: 'Loop', value: loopMode, inline: true },
      );

    if (track.duration) {
      embed.addFields({ name: 'Duration', value: formatDuration(track.duration), inline: true });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
