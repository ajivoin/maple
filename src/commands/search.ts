import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import { YtDlpError, resolveSearch } from '../audio/ytdlp.js';
import { logger } from '../logger.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search YouTube and play the top result.')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription("Search terms, e.g. 'lo-fi hip hop'")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member;
    const voiceChannel =
      member instanceof GuildMember ? member.voice.channel : null;
    if (!voiceChannel) {
      await interaction.reply({
        content: 'You need to be in a voice channel first.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    let track;
    try {
      const resolved = await resolveSearch(query);
      track = { ...resolved, requestedBy: interaction.user.id };
    } catch (err) {
      const message =
        err instanceof YtDlpError ? err.message : 'Failed to find a track.';
      logger.error('resolveSearch failed:', err);
      await interaction.editReply(`Could not find a track for that query. ${message}`);
      return;
    }

    const player = playerManager.getOrCreate(voiceChannel);
    if (interaction.channel?.isTextBased() && !interaction.channel.isDMBased()) {
      player.setTextChannel(interaction.channel);
    }

    const { position, started } = await player.enqueue(track);
    if (started) {
      await interaction.editReply(`Now playing: **${track.title}**`);
    } else {
      await interaction.editReply(`Queued **${track.title}** at position ${position}.`);
    }
  },
};

export default command;
