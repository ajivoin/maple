import { describe, expect, it, vi } from 'vitest';
import type Parser from 'rss-parser';

vi.mock('../config.js', () => ({ config: { RSS_POLL_INTERVAL_MS: 600000 } }));

import { extractPosterUrl } from '../modules/letterboxd/feeds.js';
import { buildItemEmbed } from '../modules/rss/service.js';

describe('extractPosterUrl', () => {
  it('extracts src from an img tag in item.content (RSS 2.0 <description>)', () => {
    const item = {
      content:
        '<p><img src="https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg"/></p><p>Watched on Sunday.</p>',
    } as Parser.Item;
    expect(extractPosterUrl(item)).toBe(
      'https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg',
    );
  });

  it('falls back to item.summary when content is absent (Atom feeds)', () => {
    const item = {
      summary:
        '<p><img src="https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg"/></p>',
    } as Parser.Item;
    expect(extractPosterUrl(item)).toBe(
      'https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg',
    );
  });

  it('returns null when neither field has an img tag', () => {
    const item = { content: '<p>No image here.</p>' } as Parser.Item;
    expect(extractPosterUrl(item)).toBeNull();
  });

  it('returns null when both fields are absent', () => {
    expect(extractPosterUrl({} as Parser.Item)).toBeNull();
  });
});

describe('buildItemEmbed', () => {
  const item: Parser.Item = {
    title: 'Rush Hour, 1998 - ★★★½',
    link: 'https://letterboxd.com/dave/film/rush-hour/',
    isoDate: '2026-06-01T00:00:00.000Z',
  };

  it('sets a thumbnail when thumbnailUrl is provided', () => {
    const url = 'https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg';
    const embed = buildItemEmbed('Dave (Letterboxd)', item, false, url);
    expect(embed.toJSON().thumbnail?.url).toBe(url);
  });

  it('has no thumbnail when thumbnailUrl is omitted', () => {
    const embed = buildItemEmbed('Dave (Letterboxd)', item, false);
    expect(embed.toJSON().thumbnail).toBeUndefined();
  });

  it('has no thumbnail when thumbnailUrl is null', () => {
    const embed = buildItemEmbed('Dave (Letterboxd)', item, false, null);
    expect(embed.toJSON().thumbnail).toBeUndefined();
  });
});
