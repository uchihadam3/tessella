/**
 * Audio entry point. TEMPORARY no-op implementation — replaced by the real engine.
 * Keep the export name `audio` and the AudioAPI interface.
 */
import type { AudioAPI, SpatialHandle } from './api';

const noopHandle: SpatialHandle = { setPosition() {}, setGain() {}, stop() {} };

export const audio: AudioAPI = {
  ready: false,
  async unlock() {},
  setVolumes() {},
  suspend() {},
  resume() {},
  setMusic() {},
  setProgress() {},
  duck() {},
  studioSting() {},
  titleTile() {},
  titleResolve() {},
  playEnding() {},
  tile() {},
  panelEngage() {},
  panelLeave() {},
  panelSolved() {},
  panelFailed() {},
  panelPowered() {},
  cable() {},
  door() {},
  totem() {},
  greatUnlock() {},
  secretSolved() {},
  uiHover() {},
  uiClick() {},
  uiBack() {},
  achievement() {},
  save() {},
  footstep() {},
  setAmbience() {},
  setListener() {},
  addSource() {
    return noopHandle;
  },
};

export type * from './api';
