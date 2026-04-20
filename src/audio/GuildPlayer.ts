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

    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.starting) return;
      this.queue.shift();
      if (this.queue.length === 0) {
        this.scheduleIdleDisconnect();
      } else {
        void this.playCurrent();
      }
    });

    this.player.on('error', (err) => {
      logger.error(`AudioPlayer error in guild ${this.guildId}:`, err);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
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
    if (isFirst) {
      await this.playCurrent();
    }
    return { position, started: isFirst };
  }

  pauseToggle(): 'paused' | 'resumed' | 'idle' {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.player.pause();
      return 'paused';
    }
    if (this.player.state.status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      return 'resumed';
    }
    return 'idle';
  }

  skip(): boolean {
    if (this.queue.length === 0) return false;
    this.player.stop(true);
    return true;
  }

  async rewind(): Promise<boolean> {
    if (this.queue.length === 0) return false;
    await this.playCurrent();
    return true;
  }

  stop(): void {
    this.queue = [];
    this.player.stop(true);
    this.destroy();
  }

  private async playCurrent(): Promise<void> {
    const track = this.queue[0];
    if (!track) return;

    this.starting = true;
    try {
      const stream = createAudioStream(track.url);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      this.player.play(resource);
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
    this.clearIdleTimer();
    try {
      this.connection.destroy();
    } catch {
      // already destroyed
    }
    this.onDestroy?.();
  }
}
