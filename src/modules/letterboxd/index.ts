import type { Module } from '../../types.js';
import letterboxdAdd from './commands/letterboxd_add.js';
import letterboxdList from './commands/letterboxd_list.js';
import letterboxdRemove from './commands/letterboxd_remove.js';
import letterboxdPause from './commands/letterboxd_pause.js';
import letterboxdResume from './commands/letterboxd_resume.js';

export const LetterboxdModule: Module = {
  name: 'letterboxd',
  commands: [letterboxdAdd, letterboxdList, letterboxdRemove, letterboxdPause, letterboxdResume],
};
