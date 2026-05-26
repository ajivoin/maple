import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { listSubscriptions, pauseSubscription } from '../../rss/db.js';
import { buildFeedUrl, isLetterboxdFeed, usernameFromFeedUrl } from '../feeds.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('letterboxd_pause')
    .setDescription('Pause a Letterboxd diary subscription in this channel.')
    .addStringOption((opt) =>
      opt
        .setName('username')
        .setDescription('Letterboxd username')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const subs = listSubscriptions(interaction.channelId ?? '').filter(
      (s) => isLetterboxdFeed(s.feed_url) && !s.paused,
    );
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = subs
      .filter((s) =>
        (usernameFromFeedUrl(s.feed_url) ?? s.feed_url).toLowerCase().includes(focused),
      )
      .slice(0, 25)
      .map((s) => {
        const username = usernameFromFeedUrl(s.feed_url) ?? s.feed_url;
        return { name: username, value: username };
      });
    await interaction.respond(choices).catch(() => null);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;

    const username = interaction.options.getString('username', true).trim();
    const url = buildFeedUrl(username);

    const subs = listSubscriptions(interaction.channelId);
    const sub = subs.find((s) => s.feed_url === url);

    if (!sub) {
      await interaction.reply({
        content: 'No Letterboxd subscription found for that username in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub.paused) {
      await interaction.reply({
        content: `**${username}**'s Letterboxd diary is already paused.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const hasManage =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
    if (sub.created_by !== interaction.user.id && !hasManage) {
      await interaction.reply({
        content:
          'You can only pause subscriptions you created. Members with Manage Channels can pause any subscription.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    pauseSubscription(interaction.channelId, url);

    await interaction.reply({
      content: `Paused **${username}**'s Letterboxd diary.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
