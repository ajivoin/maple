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

const send = vi.fn();

function makeClient(): Client {
  return {
    channels: { fetch: vi.fn(async () => ({ isSendable: () => true, send })) },
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
    paused: 1,
    auto_paused: 1,
    error_count: 3,
    created_by: 'u1',
    created_at: 0,
    ...overrides,
  };
}

describe('RssPoller.retryAutoPaused', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseURL.mockReset();
  });

  it('resumes an auto-paused Letterboxd feed once it parses again', async () => {
    const sub = makeSub();
    vi.mocked(rssDb.getAutoPausedSubscriptions).mockReturnValue([sub]);
    parseURL.mockResolvedValue({ title: 'Feed', items: [] });

    await new RssPoller(makeClient()).retryAutoPaused();

    expect(rssDb.resumeAutoPaused).toHaveBeenCalledWith(sub.id);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('reachable again'));
  });

  it('posts items published while the feed was paused', async () => {
    const sub = makeSub();
    vi.mocked(rssDb.getAutoPausedSubscriptions).mockReturnValue([sub]);
    parseURL.mockResolvedValue({
      title: 'Feed',
      items: [
        {
          title: 'Rush Hour, 1998',
          link: 'https://letterboxd.com/someone/film/rush-hour/',
          guid: 'new-guid',
          isoDate: new Date(5000).toISOString(),
        },
      ],
    });

    await new RssPoller(makeClient()).retryAutoPaused();

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.anything() }));
    expect(rssDb.updateAfterPoll).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ lastItemGuid: 'new-guid' }),
    );
  });

  it('leaves the feed paused when it still fails', async () => {
    vi.mocked(rssDb.getAutoPausedSubscriptions).mockReturnValue([makeSub()]);
    parseURL.mockRejectedValue(new Error('404'));

    await new RssPoller(makeClient()).retryAutoPaused();

    expect(rssDb.resumeAutoPaused).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores auto-paused feeds that are not Letterboxd', async () => {
    vi.mocked(rssDb.getAutoPausedSubscriptions).mockReturnValue([
      makeSub({ feed_url: 'https://example.com/feed.xml' }),
    ]);

    await new RssPoller(makeClient()).retryAutoPaused();

    expect(parseURL).not.toHaveBeenCalled();
    expect(rssDb.resumeAutoPaused).not.toHaveBeenCalled();
  });
});
