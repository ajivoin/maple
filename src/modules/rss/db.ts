import { getDb } from '../../db/index.js';

export type RssSubscription = {
  id: number;
  guild_id: string;
  channel_id: string;
  feed_url: string;
  feed_name: string | null;
  last_checked_at: number | null;
  last_item_guid: string | null;
  last_item_date: number | null;
  paused: number;
  auto_paused: number;
  error_count: number;
  created_by: string;
  created_at: number;
};

export function addSubscription(params: {
  guildId: string;
  channelId: string;
  feedUrl: string;
  feedName: string | null;
  createdBy: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO rss_subscriptions (guild_id, channel_id, feed_url, feed_name, created_by)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(params.guildId, params.channelId, params.feedUrl, params.feedName, params.createdBy);
  return Number(result.lastInsertRowid);
}

export function removeSubscription(channelId: string, feedUrl: string): boolean {
  const result = getDb()
    .prepare(`DELETE FROM rss_subscriptions WHERE channel_id = ? AND feed_url = ?`)
    .run(channelId, feedUrl);
  return result.changes > 0;
}

export function listSubscriptions(channelId: string): RssSubscription[] {
  return getDb()
    .prepare(`SELECT * FROM rss_subscriptions WHERE channel_id = ? ORDER BY created_at ASC`)
    .all(channelId) as RssSubscription[];
}

export function getActiveSubscriptions(): RssSubscription[] {
  return getDb()
    .prepare(`SELECT * FROM rss_subscriptions WHERE paused = 0`)
    .all() as RssSubscription[];
}

/** Subscriptions the poller paused itself after repeated failures. */
export function getAutoPausedSubscriptions(): RssSubscription[] {
  return getDb()
    .prepare(`SELECT * FROM rss_subscriptions WHERE paused = 1 AND auto_paused = 1`)
    .all() as RssSubscription[];
}

export function pauseSubscription(channelId: string, feedUrl: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE rss_subscriptions SET paused = 1, auto_paused = 0 WHERE channel_id = ? AND feed_url = ?`,
    )
    .run(channelId, feedUrl);
  return result.changes > 0;
}

export function resumeSubscription(channelId: string, feedUrl: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE rss_subscriptions SET paused = 0, auto_paused = 0, error_count = 0
       WHERE channel_id = ? AND feed_url = ?`,
    )
    .run(channelId, feedUrl);
  return result.changes > 0;
}

export function updateAfterPoll(
  id: number,
  params: { lastCheckedAt: number; lastItemGuid: string | null; lastItemDate: number | null },
): void {
  getDb()
    .prepare(
      `UPDATE rss_subscriptions
       SET last_checked_at = ?, last_item_guid = ?, last_item_date = ?
       WHERE id = ?`,
    )
    .run(params.lastCheckedAt, params.lastItemGuid, params.lastItemDate, id);
}

export function incrementErrorCount(id: number): number {
  getDb()
    .prepare(`UPDATE rss_subscriptions SET error_count = error_count + 1 WHERE id = ?`)
    .run(id);
  const row = getDb().prepare(`SELECT error_count FROM rss_subscriptions WHERE id = ?`).get(id) as
    | { error_count: number }
    | undefined;
  return row?.error_count ?? 0;
}

export function pauseWithError(id: number): void {
  getDb().prepare(`UPDATE rss_subscriptions SET paused = 1, auto_paused = 1 WHERE id = ?`).run(id);
}

/** Clears an automatic pause once the feed is reachable again. */
export function resumeAutoPaused(id: number): void {
  getDb()
    .prepare(
      `UPDATE rss_subscriptions SET paused = 0, auto_paused = 0, error_count = 0 WHERE id = ?`,
    )
    .run(id);
}

export function resetErrorCount(id: number): void {
  getDb().prepare(`UPDATE rss_subscriptions SET error_count = 0 WHERE id = ?`).run(id);
}
