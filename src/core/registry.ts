import type { SlashCommand } from '../types.js';

const _map = new Map<string, SlashCommand>();
const _list: SlashCommand[] = [];

export function registerCommand(cmd: SlashCommand): void {
  _map.set(cmd.data.name, cmd);
  _list.push(cmd);
}

export function getCommandMap(): ReadonlyMap<string, SlashCommand> {
  return _map;
}

export function getAllCommands(): readonly SlashCommand[] {
  return _list;
}
