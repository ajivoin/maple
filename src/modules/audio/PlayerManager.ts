import type { VoiceBasedChannel } from 'discord.js';
import { GuildPlayer } from './GuildPlayer.js';

class PlayerManager {
  private readonly players = new Map<string, GuildPlayer>();

  get(guildId: string): GuildPlayer | undefined {
    return this.players.get(guildId);
  }

  getOrCreate(channel: VoiceBasedChannel): GuildPlayer {
    const existing = this.players.get(channel.guild.id);
    if (existing) return existing;
    const player = new GuildPlayer(channel, () => this.players.delete(channel.guild.id));
    this.players.set(channel.guild.id, player);
    return player;
  }
}

export const playerManager = new PlayerManager();
