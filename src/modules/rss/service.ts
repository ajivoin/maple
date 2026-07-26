import Parser from 'rss-parser';
import { EmbedBuilder, type Client } from 'discord.js';
import { logger } from '../../logger.js';
import { config } from '../../config.js';
import * as rssDb from './db.js';
import type { RssSubscription } from './db.js';
import { extractPosterUrl } from '../letterboxd/feeds.js';

const DESCRIPTION_MAX_CHARS = 300;

export function truncateAtWord(text: string): string {
  if (text.length <= DESCRIPTION_MAX_CHARS) return text;
  const cut = text.lastIndexOf(' ', DESCRIPTION_MAX_CHARS);
  return text.slice(0, cut > 0 ? cut : DESCRIPTION_MAX_CHARS) + ' [...]';
}

export function buildItemEmbed(
  feedTitle: string,
  item: Parser.Item,
  includeDescription = true,
  thumbnailUrl?: string | null,
): EmbedBuilder {
  const raw = (item.contentSnippet ?? item.summary ?? '').trim();
  const hasSpoilers = raw.includes('This review may contain spoilers.');
  const description = includeDescription && raw && !hasSpoilers ? truncateAtWord(raw) : null;
  const embed = new EmbedBuilder()
    .setTitle(item.title ?? 'New post')
    .setURL(item.link ?? null)
    .setDescription(description)
    .setFooter({ text: feedTitle })
    .setTimestamp(item.isoDate ? new Date(item.isoDate) : null)
    .setColor(0x5865f2);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}

const parser = new Parser();
const MAX_ERROR_COUNT = 3;

export class RssPoller {
  private client: Client;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    void this.poll();
    this.intervalId = setInterval(() => void this.poll(), config.RSS_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    const subs = rssDb.getActiveSubscriptions();
    if (subs.length === 0) return;
    logger.info(`[rss] Polling ${subs.length} active subscription(s).`);
    await Promise.allSettled(subs.map((sub) => this.pollOne(sub)));
  }

  private async pollOne(sub: RssSubscription): Promise<void> {
    try {
      const feed = await parser.parseURL(sub.feed_url);
      const newItems = this.filterNewItems(feed.items, sub);
      const feedTitle = sub.feed_name ?? feed.title ?? 'RSS Feed';

      if (newItems.length > 0) {
        const channel = await this.client.channels.fetch(sub.channel_id).catch(() => null);
        if (channel?.isSendable()) {
          const isLetterboxd = sub.feed_url.includes('letterboxd.com');
          for (const item of newItems.slice().reverse()) {
            const thumbnailUrl = isLetterboxd ? extractPosterUrl(item) : null;
            await channel.send({
              embeds: [buildItemEmbed(feedTitle, item, true, thumbnailUrl)],
            });
          }
        }
      }

      const latest = newItems[0];
      rssDb.updateAfterPoll(sub.id, {
        lastCheckedAt: Date.now(),
        lastItemGuid: latest?.guid ?? latest?.link ?? sub.last_item_guid,
        lastItemDate: latest?.isoDate ? new Date(latest.isoDate).getTime() : sub.last_item_date,
      });
      rssDb.resetErrorCount(sub.id);
    } catch (err) {
      logger.error(`[rss] Error polling ${sub.feed_url}:`, err);
      const newCount = rssDb.incrementErrorCount(sub.id);
      if (newCount >= MAX_ERROR_COUNT) {
        rssDb.pauseWithError(sub.id);
        await this.postWarning(sub.channel_id, sub.feed_url, sub.feed_name);
      }
    }
  }

  private filterNewItems(items: Parser.Item[], sub: RssSubscription): Parser.Item[] {
    if (!sub.last_item_date && !sub.last_item_guid) {
      return [];
    }

    if (sub.last_item_date) {
      const lastIdx = items.findIndex((item) => (item.guid ?? item.link) === sub.last_item_guid);
      return items.filter((item) => {
        const itemDate = item.isoDate ? new Date(item.isoDate).getTime() : null;
        if (itemDate !== null) return itemDate > sub.last_item_date!;
        // No date on this item — fall back to GUID position (earlier index = newer in feeds)
        return lastIdx !== -1 && items.indexOf(item) < lastIdx;
      });
    }

    // Fallback for date-less feeds: items appearing before the last-seen GUID
    // in feed order are newer (feeds are reverse-chronological).
    const lastIdx = items.findIndex((item) => (item.guid ?? item.link) === sub.last_item_guid);
    if (lastIdx === -1) return [];
    return items.slice(0, lastIdx);
  }

  private async postWarning(
    channelId: string,
    feedUrl: string,
    feedName: string | null,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isSendable()) return;
    const label = feedName ?? feedUrl;
    await channel.send(
      `⚠️ The RSS feed **${label}** has failed ${MAX_ERROR_COUNT} times and has been paused. ` +
        `Fix the feed URL or use \`/rss_resume\` to re-enable it.`,
    );
  }
}
