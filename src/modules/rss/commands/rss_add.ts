import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import Parser from 'rss-parser';
import { addSubscription, updateAfterPoll } from '../db.js';
import { buildItemEmbed } from '../service.js';
import { requireManageChannels } from '../../../permissions.js';
import { logger } from '../../../logger.js';
import type { SlashCommand } from '../../../types.js';

const parser = new Parser();

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rss_add')
    .setDescription('Subscribe this channel to an RSS feed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt.setName('url').setDescription('RSS or Atom feed URL').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Friendly name for the feed').setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName('post_latest')
        .setDescription('Post the most recent item immediately when subscribing (default: true)')
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    if (!(await requireManageChannels(interaction))) return;

    const url = interaction.options.getString('url', true);
    const customName = interaction.options.getString('name');
    const postLatest = interaction.options.getBoolean('post_latest') ?? true;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      await interaction.reply({
        content: "That doesn't look like a valid URL.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await interaction.reply({
        content: 'Only HTTP and HTTPS feed URLs are supported.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let feed: Awaited<ReturnType<typeof parser.parseURL>>;
    let feedTitle: string;
    try {
      feed = await parser.parseURL(url);
      feedTitle = feed.title ?? url;
    } catch {
      await interaction.editReply(
        'Could not fetch or parse that URL as an RSS/Atom feed. Make sure it points to a valid feed.',
      );
      return;
    }

    const feedName = customName ?? feedTitle;

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
        await interaction.editReply('This channel is already subscribed to that feed.');
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

      if (postLatest) {
        const ch = interaction.channel;
        if (ch?.isSendable()) {
          await ch.send({ embeds: [buildItemEmbed(feedName, latestItem)] });
          logger.info(`[rss] Posted latest item "${latestItem.title}" to ${interaction.channelId}`);
        } else {
          logger.warn(`[rss] Could not send to channel ${interaction.channelId} (not sendable)`);
        }
      }
    } else {
      logger.info(`[rss] No items in feed at subscribe time; baseline not set.`);
    }

    await interaction.editReply(`Subscribed to **${feedName}** in this channel.`);
  },
};

export default command;
