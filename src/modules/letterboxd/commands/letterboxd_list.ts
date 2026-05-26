import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listSubscriptions } from '../../rss/db.js';
import { isLetterboxdFeed, usernameFromFeedUrl } from '../feeds.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('letterboxd_list')
    .setDescription('List Letterboxd diaries subscribed in this channel.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;

    const subs = listSubscriptions(interaction.channelId).filter((s) =>
      isLetterboxdFeed(s.feed_url),
    );

    if (subs.length === 0) {
      await interaction.reply({
        content: 'No Letterboxd diaries are subscribed in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Letterboxd Diaries in this channel')
      .setColor(0x00e054);

    for (const sub of subs.slice(0, 25)) {
      const username = usernameFromFeedUrl(sub.feed_url) ?? sub.feed_url;
      const status = sub.paused ? '⏸ Paused' : '✅ Active';
      const lastChecked = sub.last_checked_at
        ? `<t:${Math.floor(sub.last_checked_at / 1000)}:R>`
        : 'Never';
      embed.addFields({
        name: username,
        value: `${status} · Last checked: ${lastChecked}`,
      });
    }

    if (subs.length > 25) {
      embed.setFooter({ text: `Showing 25 of ${subs.length} subscriptions` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
