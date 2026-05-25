import Parser from 'rss-parser';
import { EmbedBuilder, type Client } from 'discord.js';
import { logger } from '../../logger.js';
import { config } from '../../config.js';
import * as rssDb from './db.js';
import type { RssSubscription } from './db.js';

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

      for (const item of newItems.slice().reverse()) {
        await this.postItem(sub.channel_id, feed.title ?? sub.feed_name ?? 'RSS Feed', item);
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

    return items.filter((item) => {
      if (sub.last_item_date) {
        const itemDate = item.isoDate ? new Date(item.isoDate).getTime() : null;
        if (itemDate && itemDate > sub.last_item_date!) return true;
      }
      if (sub.last_item_guid) {
        const itemId = item.guid ?? item.link;
        if (itemId && itemId !== sub.last_item_guid) return true;
      }
      return false;
    });
  }

  private async postItem(channelId: string, feedTitle: string, item: Parser.Item): Promise<void> {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isSendable()) return;

    const description = (item.contentSnippet ?? item.summary ?? '').slice(0, 200) || null;
    const embed = new EmbedBuilder()
      .setTitle(item.title ?? 'New post')
      .setURL(item.link ?? null)
      .setDescription(description)
      .setFooter({ text: feedTitle })
      .setTimestamp(item.isoDate ? new Date(item.isoDate) : null)
      .setColor(0x5865f2);

    await channel.send({ embeds: [embed] });
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
