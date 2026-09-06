import type Parser from 'rss-parser';

export function extractReviewText(item: Parser.Item): string | null {
  const snippet = item.contentSnippet ?? item.summary ?? '';
  const cleaned = snippet.replace(/Watched on \w+ \w+ \d+, \d+\./g, '').trim();
  return cleaned || null;
}

/**
 * Pulls the diary "Watched on <Weekday> <Month> <Day>, <Year>." date out of a
 * Letterboxd item. Returns null when the line is absent or unparseable.
 */
export function extractWatchedDate(item: Parser.Item): Date | null {
  const snippet = item.contentSnippet ?? item.summary ?? '';
  const match = snippet.match(/Watched on \w+ (\w+ \d+, \d+)\./);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function extractPosterUrl(item: Parser.Item): string | null {
  const match = (item.content ?? item.summary ?? '').match(/<img[^>]+src="([^"]+)"/);
  return match?.[1] ?? null;
}

export function buildFeedUrl(username: string): string {
  return `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
}

export function isLetterboxdFeed(url: string): boolean {
  return url.includes('letterboxd.com');
}

export function usernameFromFeedUrl(url: string): string | null {
  const match = url.match(/letterboxd\.com\/([^/]+)\/rss\/?/);
  return match?.[1] ?? null;
}
