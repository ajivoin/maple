import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

export type Track = {
  url: string;
  title: string;
  duration?: number;
  requestedBy: string;
};

export type LoopMode = 'off' | 'track' | 'queue';

export type SlashCommand = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

export type EventRegistrar = (client: Client) => void;

export interface Module {
  name: string;
  commands: SlashCommand[];
  intents?: GatewayIntentBits[];
  events?: EventRegistrar[];
  onReady?: (client: Client) => void | Promise<void>;
}
