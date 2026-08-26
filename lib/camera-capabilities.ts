import type { Camera } from "@/types/camera";

export interface CameraCapabilityStats {
  total: number;
  withProviderUrl: number;
  withLivePlayer: number;
  snapshotOnly: number;
}

export function getCameraCapabilityStats(cameras: Camera[]): CameraCapabilityStats {
  return {
    total: cameras.length,
    withProviderUrl: cameras.filter((camera) => Boolean(camera.providerUrl)).length,
    withLivePlayer: cameras.filter((camera) => camera.hasLiveStream === true && Boolean(camera.livePlayer?.url)).length,
    snapshotOnly: cameras.filter((camera) => camera.hasLiveStream !== true || !camera.livePlayer?.url).length,
  };
}
