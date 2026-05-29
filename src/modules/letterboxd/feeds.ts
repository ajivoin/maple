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
