import type { SlashCommand } from '../types.js';
import pause from './pause.js';
import play from './play.js';
import rewind from './rewind.js';
import save from './save.js';
import skip from './skip.js';
import stop from './stop.js';

export const commands: SlashCommand[] = [play, pause, stop, skip, rewind, save];

export const commandMap: Map<string, SlashCommand> = new Map(
  commands.map((c) => [c.data.name, c]),
);
