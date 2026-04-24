import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { playerManager } from '../audio/PlayerManager.js';
import type { SlashCommand } from '../types.js';
import { formatDuration } from '../util.js';

const DISPLAY_LIMIT = 10;

const command: SlashCommand = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current queue.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const player = playerManager.get(interaction.guildId);
    const tracks = player?.getQueue() ?? [];

    if (tracks.length === 0) {
      await interaction.reply({ content: 'The queue is empty.', flags: MessageFlags.Ephemeral });
      return;
    }

    const [current, ...upcoming] = tracks;
    const dur = (d?: number) => (d ? ` [${formatDuration(d)}]` : '');

    const embed = new EmbedBuilder().setTitle('🍁 Queue').setColor(0xe6892f);

    embed.addFields({
      name: 'Now playing',
      value: `**${current!.title}**${dur(current!.duration)}`,
    });

    if (upcoming.length > 0) {
      const shown = upcoming.slice(0, DISPLAY_LIMIT);
      const lines = shown.map((t, i) => `${i + 2}. **${t.title}**${dur(t.duration)}`);
      const overflow = upcoming.length - shown.length;
      if (overflow > 0) lines.push(`*…and ${overflow} more*`);
      embed.addFields({ name: 'Up next', value: lines.join('\n') });
    }

    const loopMode = player?.getLoopMode();
    if (loopMode && loopMode !== 'off') {
      embed.setFooter({ text: `Loop: ${loopMode}` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
