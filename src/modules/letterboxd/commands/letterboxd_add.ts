import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import Parser from 'rss-parser';
import { addSubscription, updateAfterPoll } from '../../rss/db.js';
import { buildItemEmbed } from '../../rss/service.js';
import { buildFeedUrl, extractPosterUrl, extractReviewText } from '../feeds.js';
import { logger } from '../../../logger.js';
import type { SlashCommand } from '../../../types.js';

const parser = new Parser();

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('letterboxd_add')
    .setDescription('Subscribe this channel to a Letterboxd diary.')
    .addStringOption((opt) =>
      opt.setName('username').setDescription('Letterboxd username').setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;

    const username = interaction.options.getString('username', true).trim();
    const url = buildFeedUrl(username);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let feed: Awaited<ReturnType<typeof parser.parseURL>>;
    try {
      feed = await parser.parseURL(url);
    } catch {
      await interaction.editReply(
        `Could not find a Letterboxd diary for **${username}**. Check the username and try again.`,
      );
      return;
    }

    const feedName = `${username}'s Letterboxd`;

    let subId: number;
    try {
      subId = addSubscription({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        feedUrl: url,
        feedName,
        createdBy: interaction.user.id,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await interaction.editReply(
          `This channel is already subscribed to **${username}**'s Letterboxd diary.`,
        );
        return;
      }
      throw err;
    }

    const latestItem = feed.items[0] ?? null;
    if (latestItem) {
      updateAfterPoll(subId, {
        lastCheckedAt: Date.now(),
        lastItemGuid: latestItem.guid ?? latestItem.link ?? null,
        lastItemDate: latestItem.isoDate ? new Date(latestItem.isoDate).getTime() : null,
      });

      const ch = interaction.channel;
      if (ch?.isSendable()) {
        const thumbnailUrl = extractPosterUrl(latestItem);
        const cleaned = {
          ...latestItem,
          contentSnippet: extractReviewText(latestItem) ?? undefined,
        };
        await ch.send({ embeds: [buildItemEmbed(feedName, cleaned, true, thumbnailUrl)] });
        logger.info(
          `[letterboxd] Posted latest diary entry for ${username} to ${interaction.channelId}`,
        );
      }
    }

    await interaction.editReply(
      `Subscribed to **${username}**'s Letterboxd diary in this channel.`,
    );
  },
};

export default command;
