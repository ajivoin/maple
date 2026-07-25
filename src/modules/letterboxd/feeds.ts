import type Parser from 'rss-parser';

export function extractPosterUrl(item: Parser.Item): string | null {
  const match = (item.summary ?? '').match(/<img[^>]+src="([^"]+)"/);
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
