import { describe, expect, it, vi } from 'vitest';
import type Parser from 'rss-parser';

vi.mock('../config.js', () => ({ config: { RSS_POLL_INTERVAL_MS: 600000 } }));

import { extractPosterUrl } from '../modules/letterboxd/feeds.js';
import { buildItemEmbed, truncateAtWord } from '../modules/rss/service.js';

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
      summary: '<p><img src="https://a.ltrbxd.com/resized/film-poster/50517-rush-hour.jpg"/></p>',
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

describe('truncateAtWord', () => {
  it('returns text unchanged when within limit', () => {
    expect(truncateAtWord('short text')).toBe('short text');
  });

  it('cuts at the last word boundary before the limit and appends [...]', () => {
    const words = 'word '.repeat(70).trimEnd(); // well over 300 chars
    const result = truncateAtWord(words);
    expect(result.endsWith(' [...]')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(300 + ' [...]'.length);
    expect(result).not.toMatch(/word word\S/); // no mid-word cut
  });

  it('falls back to hard cut when no space exists before the limit', () => {
    const noSpaces = 'a'.repeat(400);
    const result = truncateAtWord(noSpaces);
    expect(result.endsWith(' [...]')).toBe(true);
    expect(result.length).toBe(300 + ' [...]'.length);
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

  it('includes description when no spoiler line is present', () => {
    const embed = buildItemEmbed('Dave (Letterboxd)', {
      ...item,
      contentSnippet: 'A great film with memorable action sequences.',
    });
    expect(embed.toJSON().description).toBe('A great film with memorable action sequences.');
  });

  it('suppresses description when Letterboxd spoiler line is present', () => {
    const embed = buildItemEmbed('Dave (Letterboxd)', {
      ...item,
      contentSnippet: 'This review may contain spoilers. The ending is shocking.',
    });
    expect(embed.toJSON().description).toBeUndefined();
  });

  it('does not suppress description that merely mentions the word spoiler', () => {
    const embed = buildItemEmbed('Dave (Letterboxd)', {
      ...item,
      contentSnippet: 'I hate spoiler culture but loved this film.',
    });
    expect(embed.toJSON().description).toBe('I hate spoiler culture but loved this film.');
  });
});
