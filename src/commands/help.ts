import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import loop from './loop.js';
import nowplaying from './nowplaying.js';
import pause from './pause.js';
import play from './play.js';
import queue from './queue.js';
import remove from './remove.js';
import rewind from './rewind.js';
import save from './save.js';
import search from './search.js';
import shuffle from './shuffle.js';
import skip from './skip.js';
import stop from './stop.js';

const LISTED = [play, search, pause, stop, skip, rewind, save, queue, nowplaying, loop, shuffle, remove];

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands.'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🍁 Maple — Commands')
      .setColor(0xe6892f)
      .setDescription('Here are all available commands:')
      .setFooter({ text: 'Maple must be in the server to accept commands.' });

    for (const cmd of LISTED) {
      const json = cmd.data.toJSON();
      const options = json.options ?? [];

      let value = json.description;
      if (options.length > 0) {
        const lines = options.map(
          (opt) =>
            `> \`${opt.name}\` ${opt.required ? '*(required)*' : '*(optional)*'} — ${opt.description}`,
        );
        value += '\n' + lines.join('\n');
      }

      embed.addFields({ name: `\`/${json.name}\``, value });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
