import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getRssPoller } from '../../rss/service.js';
import { requireManageChannels } from '../../../permissions.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('letterboxd_refresh')
    .setDescription("Force an immediate poll of this server's Letterboxd feeds.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    if (!(await requireManageChannels(interaction))) return;

    const poller = getRssPoller();
    if (!poller) {
      await interaction.reply({
        content: 'The feed poller is not running yet. Try again in a moment.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const count = await poller.refreshLetterboxd(interaction.guildId ?? undefined);
    await interaction.editReply(
      count === 0
        ? 'No active Letterboxd feeds to refresh.'
        : `Refreshed ${count} Letterboxd feed${count === 1 ? '' : 's'}. New entries will post shortly.`,
    );
  },
};

export default command;
