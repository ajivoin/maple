import { GatewayIntentBits } from 'discord.js';
import type { Module } from '../../types.js';
import { registerVoiceStateUpdate } from './events/voiceStateUpdate.js';
import loop from './commands/loop.js';
import nowplaying from './commands/nowplaying.js';
import pause from './commands/pause.js';
import play from './commands/play.js';
import queue from './commands/queue.js';
import remove from './commands/remove.js';
import rewind from './commands/rewind.js';
import save from './commands/save.js';
import search from './commands/search.js';
import shuffle from './commands/shuffle.js';
import skip from './commands/skip.js';
import stop from './commands/stop.js';

export const AudioModule: Module = {
  name: 'audio',
  intents: [GatewayIntentBits.GuildVoiceStates],
  events: [registerVoiceStateUpdate],
  commands: [
    play,
    search,
    pause,
    stop,
    skip,
    rewind,
    save,
    queue,
    nowplaying,
    loop,
    shuffle,
    remove,
  ],
};
