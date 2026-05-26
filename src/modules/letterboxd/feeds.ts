export function buildFeedUrl(username: string): string {
  return `https://letterboxd.com/${encodeURIComponent(username.toLowerCase())}/rss/`;
}

export function isLetterboxdFeed(url: string): boolean {
  return /letterboxd\.com\/[^/]+\/rss\/?/.test(url);
}

export function usernameFromFeedUrl(url: string): string | null {
  const match = url.match(/letterboxd\.com\/([^/]+)\/rss\/?/);
  return match?.[1] ?? null;
}
