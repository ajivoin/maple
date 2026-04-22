import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import { hasMuteMembers } from '../permissions.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip to the next track in the queue.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    const track = player?.currentTrack();
    if (!player || !track) {
      await interaction.reply({ content: 'Nothing to skip.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!hasMuteMembers(interaction) && interaction.user.id !== track.requestedBy) {
      await interaction.reply({
        content: 'Only the person who queued this track or a moderator can skip it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    player.skip();
    await interaction.reply(`Skipped **${track.title}**.`);
  },
};

export default command;
