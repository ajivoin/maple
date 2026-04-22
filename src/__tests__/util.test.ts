import { describe, expect, it } from 'vitest';
import { formatDuration } from '../util.js';

describe('formatDuration', () => {
  it('formats whole minutes', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(120)).toBe('2:00');
  });

  it('pads seconds to two digits', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('handles long durations', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });
});
