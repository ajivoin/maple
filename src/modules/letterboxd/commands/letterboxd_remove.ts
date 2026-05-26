import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listSubscriptions, removeSubscription } from '../../rss/db.js';
import { buildFeedUrl, isLetterboxdFeed } from '../feeds.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('letterboxd_remove')
    .setDescription('Unsubscribe this channel from a Letterboxd diary.')
    .addStringOption((opt) =>
      opt
        .setName('username')
        .setDescription('Letterboxd username')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const subs = listSubscriptions(interaction.channelId ?? '').filter((s) =>
      isLetterboxdFeed(s.feed_url),
    );
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = subs
      .filter((s) => (s.feed_name ?? s.feed_url).toLowerCase().includes(focused))
      .slice(0, 25)
      .map((s) => {
        const label = s.feed_name ?? s.feed_url;
        return { name: label, value: s.feed_url };
      });
    await interaction.respond(choices).catch(() => null);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;

    // Accepts either a raw username or the feed URL (autocomplete returns URLs)
    const input = interaction.options.getString('username', true).trim();
    const url = input.startsWith('http') ? input : buildFeedUrl(input);

    const removed = removeSubscription(interaction.channelId, url);

    if (!removed) {
      await interaction.reply({
        content: 'No Letterboxd subscription found for that username in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `Unsubscribed from that Letterboxd diary.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
