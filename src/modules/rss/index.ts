import type { Client } from 'discord.js';
import type { Module } from '../../types.js';
import { RssPoller } from './service.js';
import rssAdd from './commands/rss_add.js';
import rssRemove from './commands/rss_remove.js';
import rssList from './commands/rss_list.js';
import rssPause from './commands/rss_pause.js';
import rssResume from './commands/rss_resume.js';

export const RssModule: Module = {
  name: 'rss',
  commands: [rssAdd, rssList, rssRemove, rssPause, rssResume],
  onReady: (client: Client) => {
    const poller = new RssPoller(client);
    poller.start();
  },
};
