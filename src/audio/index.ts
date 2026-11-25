/**
 * Audio entry point. The game talks to audio only through `audio` (see ./api.ts).
 * 100% Web Audio synthesis — no audio files.
 */
import type { AudioAPI } from './api';
import { engineApi } from './engine/engine';

export const audio: AudioAPI = engineApi;

export type * from './api';
