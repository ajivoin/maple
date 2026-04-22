import type { SlashCommand } from '../types.js';
import help from './help.js';
import pause from './pause.js';
import play from './play.js';
import rewind from './rewind.js';
import save from './save.js';
import search from './search.js';
import skip from './skip.js';
import stop from './stop.js';

export const commands: SlashCommand[] = [play, search, pause, stop, skip, rewind, save, help];

export const commandMap: Map<string, SlashCommand> = new Map(
  commands.map((c) => [c.data.name, c]),
);
