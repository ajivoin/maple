import {
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import type { GuildTextBasedChannel, VoiceBasedChannel } from 'discord.js';
import { logger } from '../logger.js';
import type { LoopMode, Track } from '../types.js';
import { createAudioStream } from './ytdlp.js';

const IDLE_DISCONNECT_MS = 60_000;

export class GuildPlayer {
  readonly guildId: string;
  private connection: VoiceConnection;
  private readonly player: AudioPlayer;
  private queue: Track[] = [];
  private loopMode: LoopMode = 'off';
  private textChannel: GuildTextBasedChannel | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private starting = false;
  private onDestroy?: () => void;

  constructor(channel: VoiceBasedChannel, onDestroy?: () => void) {
    this.guildId = channel.guild.id;
    this.onDestroy = onDestroy;

    logger.info(`[${this.guildId}] Joining voice channel "${channel.name}" (${channel.id})`);
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on('stateChange', (oldState, newState) => {
      logger.info(`[${this.guildId}] AudioPlayer: ${oldState.status} → ${newState.status}`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.starting) return;
      const finished = this.queue[0];

      if (this.loopMode === 'track') {
        void this.playCurrent();
        return;
      }

      this.queue.shift();
      if (finished) {
        logger.debug(`[${this.guildId}] Finished track: "${finished.title}"`);
        if (this.loopMode === 'queue') {
          this.queue.push(finished);
        }
      }

      if (this.queue.length === 0) {
        logger.info(`[${this.guildId}] Queue empty, scheduling idle disconnect.`);
        this.scheduleIdleDisconnect();
      } else {
        logger.info(`[${this.guildId}] Advancing queue (${this.queue.length} remaining).`);
        void this.playCurrent();
      }
    });

    this.player.on('error', (err) => {
      logger.error(`[${this.guildId}] AudioPlayer error:`, err);
      this.queue.shift();
      if (this.queue.length > 0) {
        logger.info(`[${this.guildId}] Skipping errored track, advancing queue.`);
        void this.playCurrent();
      } else {
        this.scheduleIdleDisconnect();
      }
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn(`[${this.guildId}] Voice connection disconnected, attempting to recover.`);
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        logger.info(`[${this.guildId}] Voice connection recovered.`);
      } catch {
        logger.warn(`[${this.guildId}] Voice connection could not recover, destroying.`);
        this.destroy();
      }
    });

    this.connection.on('stateChange', (oldState, newState) => {
      logger.info(`[${this.guildId}] VoiceConnection: ${oldState.status} → ${newState.status}`);
    });

    this.connection.on('debug', (msg) => {
      logger.debug(`[${this.guildId}] VoiceConnection debug: ${msg}`);
    });
  }

  setTextChannel(channel: GuildTextBasedChannel): void {
    this.textChannel = channel;
  }

  currentTrack(): Track | null {
    return this.queue[0] ?? null;
  }

  queueLength(): number {
    return this.queue.length;
  }

  getQueue(): Track[] {
    return [...this.queue];
  }

  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  playerStatus(): 'playing' | 'paused' | 'idle' {
    if (this.player.state.status === AudioPlayerStatus.Playing) return 'playing';
    if (this.player.state.status === AudioPlayerStatus.Paused) return 'paused';
    return 'idle';
  }

  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
    logger.info(`[${this.guildId}] Loop mode set to "${mode}".`);
  }

  async enqueue(track: Track): Promise<{ position: number; started: boolean }> {
    this.clearIdleTimer();
    this.queue.push(track);
    const position = this.queue.length;
    const isFirst = position === 1;
    logger.info(`[${this.guildId}] Enqueued "${track.title}" at position ${position} (requested by ${track.requestedBy})`);
    if (isFirst) {
      await this.playCurrent();
    }
    return { position, started: isFirst };
  }

  pauseToggle(): 'paused' | 'resumed' | 'idle' {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.player.pause();
      logger.info(`[${this.guildId}] Playback paused.`);
      return 'paused';
    }
    if (this.player.state.status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      logger.info(`[${this.guildId}] Playback resumed.`);
      return 'resumed';
    }
    logger.debug(`[${this.guildId}] pauseToggle called but player is idle.`);
    return 'idle';
  }

  skip(): boolean {
    if (this.queue.length === 0) return false;
    logger.info(`[${this.guildId}] Skipping "${this.queue[0]?.title ?? 'unknown'}".`);
    this.player.stop(true);
    return true;
  }

  shuffle(): boolean {
    if (this.queue.length < 2) return false;
    for (let i = this.queue.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i);
      [this.queue[i], this.queue[j]] = [this.queue[j]!, this.queue[i]!];
    }
    logger.info(`[${this.guildId}] Queue shuffled (${this.queue.length - 1} upcoming tracks).`);
    return true;
  }

  remove(position: number): Track | null {
    if (position < 1 || position > this.queue.length) return null;
    if (position === 1) {
      const current = this.queue[0]!;
      this.player.stop(true);
      return current;
    }
    const [removed] = this.queue.splice(position - 1, 1);
    logger.info(`[${this.guildId}] Removed "${removed?.title}" from queue position ${position}.`);
    return removed ?? null;
  }

  async rewind(): Promise<boolean> {
    if (this.queue.length === 0) return false;
    logger.info(`[${this.guildId}] Rewinding "${this.queue[0]?.title ?? 'unknown'}".`);
    await this.playCurrent();
    return true;
  }

  stop(): void {
    logger.info(`[${this.guildId}] Stop called, clearing ${this.queue.length} track(s).`);
    this.queue = [];
    this.player.stop(true);
    this.destroy();
  }

  private async playCurrent(): Promise<void> {
    const track = this.queue[0];
    if (!track) return;

    if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
      logger.info(`[${this.guildId}] Waiting for voice connection to be ready...`);
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
      } catch {
        logger.error(`[${this.guildId}] Voice connection did not become ready within 20s, aborting playback.`);
        return;
      }
    }

    logger.info(`[${this.guildId}] Starting playback: "${track.title}" (${track.url})`);
    this.starting = true;
    try {
      const stream = createAudioStream(track.url);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      this.player.play(resource);
    } catch (err) {
      logger.error(`[${this.guildId}] Failed to start playback for "${track.title}":`, err);
      throw err;
    } finally {
      setImmediate(() => {
        this.starting = false;
      });
    }
  }

  private scheduleIdleDisconnect(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      logger.info(`Guild ${this.guildId}: idle timeout reached, disconnecting.`);
      this.destroy();
    }, IDLE_DISCONNECT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private destroy(): void {
    logger.info(`[${this.guildId}] Destroying GuildPlayer.`);
    this.clearIdleTimer();
    try {
      this.connection.destroy();
    } catch {
      // already destroyed
    }
    this.onDestroy?.();
  }
}
