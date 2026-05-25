import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';

export function hasMuteMembers(interaction: ChatInputCommandInteraction): boolean {
  return !!interaction.memberPermissions?.has(PermissionFlagsBits.MuteMembers);
}

export async function requireMuteMembers(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (hasMuteMembers(interaction)) return true;
  await interaction.reply({
    content: 'You need the **Mute Members** permission to use this command.',
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

export async function requireManageChannels(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  await interaction.reply({
    content: 'You need the **Manage Channels** permission to use this command.',
    flags: MessageFlags.Ephemeral,
  });
  return false;
}
