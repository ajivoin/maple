import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import { logger } from '../logger.js';
import { playerManager } from '../audio/PlayerManager.js';

export function registerVoiceStateUpdate(client: Client): void {
  client.on(Events.VoiceStateUpdate, (oldState, _newState) => {
    if (oldState.member?.user.bot) return;

    const leftChannelId = oldState.channelId;
    if (!leftChannelId) return;

    const player = playerManager.get(oldState.guild.id);
    if (!player) return;

    const botChannelId = oldState.guild.members.me?.voice.channelId;
    if (botChannelId !== leftChannelId) return;

    const channel = oldState.channel;
    if (!channel) return;

    const nonBotCount = channel.members.filter((m) => !m.user.bot).size;
    if (nonBotCount === 0) {
      logger.info(`[${oldState.guild.id}] Bot is alone in channel, disconnecting.`);
      player.stop();
    }
  });
}
