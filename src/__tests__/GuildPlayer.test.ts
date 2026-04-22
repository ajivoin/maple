import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must be before GuildPlayer import so the mock is in place when the module loads
vi.mock('@discordjs/voice', () => ({
  AudioPlayerStatus: { Idle: 'idle', Playing: 'playing', Paused: 'paused' },
  VoiceConnectionStatus: {
    Ready: 'ready',
    Disconnected: 'disconnected',
    Connecting: 'connecting',
    Signalling: 'signalling',
  },
  StreamType: { Arbitrary: 'arbitrary' },
  createAudioPlayer: vi.fn(),
  joinVoiceChannel: vi.fn(),
  createAudioResource: vi.fn(() => ({})),
  entersState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../audio/ytdlp.js', () => ({
  createAudioStream: vi.fn(() => ({})),
}));

// Deferred import so the vi.mock above is registered first
const { GuildPlayer } = await import('../audio/GuildPlayer.js');
const { createAudioPlayer, joinVoiceChannel } = await import('@discordjs/voice');

function makeTrack(title: string) {
  return { url: `https://example.com/${title}`, title, requestedBy: 'u1', duration: 180 };
}

function makeChannel() {
  return {
    id: 'ch1',
    name: 'general',
    guild: { id: 'g1', voiceAdapterCreator: {} },
  } as any;
}

let playerMock: any;
let connectionMock: any;
let gp: InstanceType<typeof GuildPlayer>;

beforeEach(() => {
  playerMock = Object.assign(new EventEmitter(), {
    play: vi.fn(),
    pause: vi.fn(),
    unpause: vi.fn(),
    stop: vi.fn(),
    state: { status: 'idle' },
  });
  connectionMock = Object.assign(new EventEmitter(), {
    subscribe: vi.fn(),
    destroy: vi.fn(),
    state: { status: 'ready' },
  });

  vi.mocked(createAudioPlayer).mockReturnValue(playerMock as any);
  vi.mocked(joinVoiceChannel).mockReturnValue(connectionMock as any);

  gp = new GuildPlayer(makeChannel());
});

describe('initial state', () => {
  it('queue is empty', () => {
    expect(gp.queueLength()).toBe(0);
    expect(gp.currentTrack()).toBeNull();
    expect(gp.getQueue()).toEqual([]);
  });

  it('loop mode defaults to off', () => {
    expect(gp.getLoopMode()).toBe('off');
  });

  it('playerStatus is idle', () => {
    expect(gp.playerStatus()).toBe('idle');
  });
});

describe('enqueue', () => {
  it('adds a track and reports started=true for first track', async () => {
    const track = makeTrack('A');
    const result = await gp.enqueue(track);
    expect(result).toEqual({ position: 1, started: true });
    expect(gp.queueLength()).toBe(1);
    expect(gp.currentTrack()).toEqual(track);
  });

  it('queues subsequent tracks without starting', async () => {
    await gp.enqueue(makeTrack('A'));
    const result = await gp.enqueue(makeTrack('B'));
    expect(result).toEqual({ position: 2, started: false });
    expect(gp.queueLength()).toBe(2);
  });
});

describe('getQueue', () => {
  it('returns a copy, not the internal reference', async () => {
    await gp.enqueue(makeTrack('A'));
    const q = gp.getQueue();
    q.pop();
    expect(gp.queueLength()).toBe(1);
  });
});

describe('setLoopMode / getLoopMode', () => {
  it('sets and gets loop mode', () => {
    gp.setLoopMode('track');
    expect(gp.getLoopMode()).toBe('track');
    gp.setLoopMode('queue');
    expect(gp.getLoopMode()).toBe('queue');
    gp.setLoopMode('off');
    expect(gp.getLoopMode()).toBe('off');
  });
});

describe('playerStatus', () => {
  it('reflects mock player state', () => {
    playerMock.state.status = 'playing';
    expect(gp.playerStatus()).toBe('playing');
    playerMock.state.status = 'paused';
    expect(gp.playerStatus()).toBe('paused');
    playerMock.state.status = 'idle';
    expect(gp.playerStatus()).toBe('idle');
  });
});

describe('shuffle', () => {
  it('returns false with fewer than 2 tracks', async () => {
    expect(gp.shuffle()).toBe(false);
    await gp.enqueue(makeTrack('A'));
    expect(gp.shuffle()).toBe(false);
  });

  it('preserves current track at position 0', async () => {
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    await gp.enqueue(makeTrack('C'));
    const current = gp.currentTrack();
    gp.shuffle();
    expect(gp.currentTrack()).toEqual(current);
  });

  it('keeps all tracks and returns true', async () => {
    const titles = ['A', 'B', 'C', 'D'];
    for (const t of titles) await gp.enqueue(makeTrack(t));
    expect(gp.shuffle()).toBe(true);
    const result = gp.getQueue().map((t) => t.title).sort();
    expect(result).toEqual(titles.slice().sort());
  });
});

describe('remove', () => {
  it('returns null for out-of-range positions', async () => {
    await gp.enqueue(makeTrack('A'));
    expect(gp.remove(0)).toBeNull();
    expect(gp.remove(2)).toBeNull();
  });

  it('removes a queued (non-current) track', async () => {
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    await gp.enqueue(makeTrack('C'));
    const removed = gp.remove(2);
    expect(removed?.title).toBe('B');
    expect(gp.queueLength()).toBe(2);
    expect(gp.getQueue().map((t) => t.title)).toEqual(['A', 'C']);
  });

  it('skips the current track when removing position 1', async () => {
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    const removed = gp.remove(1);
    expect(removed?.title).toBe('A');
    expect(playerMock.stop).toHaveBeenCalledWith(true);
  });
});

describe('idle event — loop mode', () => {
  // playCurrent() sets this.starting = true and resets it via setImmediate.
  // We must drain that callback before emitting 'idle', or the guard returns early.
  async function drainStarting() {
    await new Promise((r) => setImmediate(r));
  }

  it('advances queue when loop is off', async () => {
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    await drainStarting();
    playerMock.emit('idle');
    await new Promise((r) => setImmediate(r));
    expect(gp.currentTrack()?.title).toBe('B');
    expect(gp.queueLength()).toBe(1);
  });

  it('does not advance queue when loop=track', async () => {
    gp.setLoopMode('track');
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    await drainStarting();
    playerMock.emit('idle');
    await new Promise((r) => setImmediate(r));
    expect(gp.currentTrack()?.title).toBe('A');
    expect(gp.queueLength()).toBe(2);
  });

  it('cycles finished track to the back when loop=queue', async () => {
    gp.setLoopMode('queue');
    await gp.enqueue(makeTrack('A'));
    await gp.enqueue(makeTrack('B'));
    await drainStarting();
    playerMock.emit('idle');
    await new Promise((r) => setImmediate(r));
    expect(gp.currentTrack()?.title).toBe('B');
    expect(gp.getQueue().at(-1)?.title).toBe('A');
  });
});
