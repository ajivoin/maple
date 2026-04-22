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
import type { Track } from '../types.js';
import { createAudioStream } from './ytdlp.js';

const IDLE_DISCONNECT_MS = 60_000;

export class GuildPlayer {
  readonly guildId: string;
  private connection: VoiceConnection;
  private readonly player: AudioPlayer;
  private queue: Track[] = [];
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
      this.queue.shift();
      if (finished) logger.debug(`[${this.guildId}] Finished track: "${finished.title}"`);
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
