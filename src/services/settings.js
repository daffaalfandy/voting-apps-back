import * as settingsRepository from '../repositories/settings.js';

export const get = () => settingsRepository.get();

export const update = (changes) => settingsRepository.update(changes);
