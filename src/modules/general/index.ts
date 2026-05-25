import type { Module } from '../../types.js';
import help from './commands/help.js';

export const GeneralModule: Module = {
  name: 'general',
  commands: [help],
};
