import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import { hasMuteMembers } from '../permissions.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by its position.')
    .addIntegerOption((opt) =>
      opt
        .setName('position')
        .setDescription('Queue position to remove (1 = currently playing)')
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    if (!player || player.queueLength() === 0) {
      await interaction.reply({ content: 'The queue is empty.', flags: MessageFlags.Ephemeral });
      return;
    }

    const position = interaction.options.getInteger('position', true);
    if (position > player.queueLength()) {
      await interaction.reply({
        content: `Position ${position} is out of range — the queue has ${player.queueLength()} track(s).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const track = player.getQueue()[position - 1]!;
    if (!hasMuteMembers(interaction) && interaction.user.id !== track.requestedBy) {
      await interaction.reply({
        content: 'Only the person who queued this track or a moderator can remove it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const removed = player.remove(position);
    if (!removed) {
      await interaction.reply({
        content: 'Could not remove that track.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const label = position === 1 ? 'Skipped' : 'Removed';
    await interaction.reply(`${label} **${removed.title}** from position ${position}.`);
  },
};

export default command;
