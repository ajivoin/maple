import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import { requireMuteMembers } from '../permissions.js';
import type { LoopMode, SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode for the queue.')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'off — no looping', value: 'off' },
          { name: 'track — repeat current track', value: 'track' },
          { name: 'queue — cycle through entire queue', value: 'queue' },
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    if (!(await requireMuteMembers(interaction))) return;
    const player = playerManager.get(interaction.guildId);
    if (!player) {
      await interaction.reply({
        content: 'Nothing is playing right now.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mode = interaction.options.getString('mode', true) as LoopMode;
    player.setLoopMode(mode);

    const labels: Record<LoopMode, string> = {
      off: 'Loop disabled.',
      track: 'Looping current track.',
      queue: 'Looping entire queue.',
    };

    await interaction.reply(labels[mode]);
  },
};

export default command;
