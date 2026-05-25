import { GatewayIntentBits, type Client } from 'discord.js';
import type { Module } from '../types.js';
import { registerCommand } from './registry.js';

const DEFAULT_INTENTS = [GatewayIntentBits.Guilds];

export function loadModules(modules: Module[]): {
  intents: GatewayIntentBits[];
  registerEvents: (client: Client) => void;
  onReady: (client: Client) => Promise<void>;
} {
  const intentSet = new Set<GatewayIntentBits>(DEFAULT_INTENTS);
  const allOnReady: Array<(client: Client) => void | Promise<void>> = [];
  const allEventRegistrars: Array<(client: Client) => void> = [];

  for (const mod of modules) {
    for (const cmd of mod.commands) registerCommand(cmd);
    for (const intent of mod.intents ?? []) intentSet.add(intent);
    if (mod.onReady) allOnReady.push(mod.onReady);
    for (const reg of mod.events ?? []) allEventRegistrars.push(reg);
  }

  return {
    intents: [...intentSet],
    registerEvents: (client) => {
      for (const reg of allEventRegistrars) reg(client);
    },
    onReady: async (client) => {
      for (const hook of allOnReady) await hook(client);
    },
  };
}
