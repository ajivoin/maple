import type { Client } from 'discord.js';
import type { Module } from '../../types.js';
import { startRssPoller } from '../rss/service.js';
import letterboxdAdd from './commands/letterboxd_add.js';
import letterboxdRemove from './commands/letterboxd_remove.js';
import letterboxdList from './commands/letterboxd_list.js';

export const LetterboxdModule: Module = {
  name: 'letterboxd',
  commands: [letterboxdAdd, letterboxdList, letterboxdRemove],
  onReady: (client: Client) => {
    startRssPoller(client);
  },
};
