import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { listSubscriptions, pauseSubscription } from '../db.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rss_pause')
    .setDescription('Pause an RSS feed subscription in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Feed URL to pause')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const subs = listSubscriptions(interaction.channelId ?? '').filter((s) => s.paused === 0);
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = subs
      .filter(
        (s) =>
          s.feed_url.toLowerCase().includes(focused) ||
          (s.feed_name ?? '').toLowerCase().includes(focused),
      )
      .slice(0, 25)
      .map((s) => ({ name: s.feed_name ?? s.feed_url, value: s.feed_url }));
    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: 'You need the **Manage Channels** permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const url = interaction.options.getString('url', true);
    pauseSubscription(interaction.channelId, url);

    await interaction.reply({
      content: `Paused RSS feed: **${url}**. Use \`/rss_resume\` to re-enable it.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
