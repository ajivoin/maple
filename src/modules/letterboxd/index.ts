import type { Module } from '../../types.js';
import letterboxdAdd from './commands/letterboxd_add.js';
import letterboxdRemove from './commands/letterboxd_remove.js';
import letterboxdList from './commands/letterboxd_list.js';

export const LetterboxdModule: Module = {
  name: 'letterboxd',
  commands: [letterboxdAdd, letterboxdList, letterboxdRemove],
};
