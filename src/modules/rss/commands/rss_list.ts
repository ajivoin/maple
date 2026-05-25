import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listSubscriptions } from '../db.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rss_list')
    .setDescription('List all RSS feeds subscribed in this channel.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;

    const subs = listSubscriptions(interaction.channelId);
    if (subs.length === 0) {
      await interaction.reply({
        content: 'No RSS feeds are subscribed in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const MAX_FIELDS = 25;
    const truncated = subs.length > MAX_FIELDS;
    const visible = subs.slice(0, MAX_FIELDS);

    const embed = new EmbedBuilder().setTitle('RSS Feeds in this channel').setColor(0x5865f2);

    for (const sub of visible) {
      const status = sub.paused ? '⏸ Paused' : '✅ Active';
      const lastChecked = sub.last_checked_at
        ? `<t:${Math.floor(sub.last_checked_at / 1000)}:R>`
        : 'Never';
      embed.addFields({
        name: sub.feed_name ?? sub.feed_url,
        value: `${status} · Last checked: ${lastChecked}\n${sub.feed_url}`,
      });
    }

    if (truncated) {
      embed.setFooter({ text: `Showing 25 of ${subs.length} feeds — remove some to see the rest` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
