import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { RssSubscription } from '../modules/rss/db.js';

vi.mock('../config.js', () => ({
  config: { RSS_POLL_INTERVAL_MS: 600000, RSS_RETRY_INTERVAL_MS: 3600000 },
}));

const { parseURL } = vi.hoisted(() => ({ parseURL: vi.fn() }));
vi.mock('rss-parser', () => ({
  default: class {
    parseURL = parseURL;
  },
}));

vi.mock('../modules/rss/db.js', () => ({
  getActiveSubscriptions: vi.fn(() => []),
  getAutoPausedSubscriptions: vi.fn(() => []),
  resumeAutoPaused: vi.fn(),
  updateAfterPoll: vi.fn(),
  resetErrorCount: vi.fn(),
  incrementErrorCount: vi.fn(() => 1),
  pauseWithError: vi.fn(),
}));

import * as rssDb from '../modules/rss/db.js';
import { RssPoller } from '../modules/rss/service.js';

function makeClient(): Client {
  return {
    channels: { fetch: vi.fn(async () => ({ isSendable: () => true, send: vi.fn() })) },
  } as unknown as Client;
}

function makeSub(overrides: Partial<RssSubscription> = {}): RssSubscription {
  return {
    id: 1,
    guild_id: 'g1',
    channel_id: 'c1',
    feed_url: 'https://letterboxd.com/someone/rss/',
    feed_name: "someone's Letterboxd",
    last_checked_at: null,
    last_item_guid: 'old-guid',
    last_item_date: 1000,
    paused: 0,
    auto_paused: 0,
    error_count: 0,
    created_by: 'u1',
    created_at: 0,
    ...overrides,
  };
}

describe('RssPoller.refreshLetterboxd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseURL.mockReset();
    parseURL.mockResolvedValue({ title: 'Feed', items: [] });
  });

  it('returns 0 and does not call the parser when there are no active subscriptions', async () => {
    vi.mocked(rssDb.getActiveSubscriptions).mockReturnValue([]);

    const count = await new RssPoller(makeClient()).refreshLetterboxd();

    expect(count).toBe(0);
    expect(parseURL).not.toHaveBeenCalled();
  });

  it('polls only Letterboxd subscriptions in the given guild', async () => {
    vi.mocked(rssDb.getActiveSubscriptions).mockReturnValue([
      makeSub({ id: 1, guild_id: 'g1', feed_url: 'https://letterboxd.com/a/rss/' }),
      makeSub({ id: 2, guild_id: 'g2', feed_url: 'https://letterboxd.com/b/rss/' }),
      makeSub({ id: 3, guild_id: 'g1', feed_url: 'https://example.com/feed' }),
    ]);

    const count = await new RssPoller(makeClient()).refreshLetterboxd('g1');

    expect(count).toBe(1);
    expect(parseURL).toHaveBeenCalledTimes(1);
    expect(parseURL).toHaveBeenCalledWith('https://letterboxd.com/a/rss/');
  });
});
