import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Randomly shuffle the upcoming tracks in the queue.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    if (!player || player.queueLength() < 2) {
      await interaction.reply({
        content: 'Not enough tracks in the queue to shuffle.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    player.shuffle();
    await interaction.reply(
      `Queue shuffled — ${player.queueLength() - 1} upcoming tracks randomized.`,
    );
  },
};

export default command;
