import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import Parser from 'rss-parser';
import { addSubscription } from '../db.js';
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
    ),

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
    const customName = interaction.options.getString('name');

    try {
      new URL(url);
    } catch {
      await interaction.reply({
        content: "That doesn't look like a valid URL.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let feedTitle: string;
    try {
      const feed = await parser.parseURL(url);
      feedTitle = feed.title ?? url;
    } catch {
      await interaction.editReply(
        'Could not fetch or parse that URL as an RSS/Atom feed. Make sure it points to a valid feed.',
      );
      return;
    }

    const feedName = customName ?? feedTitle;

    try {
      addSubscription({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        feedUrl: url,
        feedName,
        createdBy: interaction.user.id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        await interaction.editReply('This channel is already subscribed to that feed.');
        return;
      }
      throw err;
    }

    await interaction.editReply(`Subscribed to **${feedName}** in this channel.`);
  },
};

export default command;
