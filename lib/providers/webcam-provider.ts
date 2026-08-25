import type { Camera } from "@/types/camera";

export interface BoundingBox {
  north: number;
  east: number;
  south: number;
  west: number;
}

export interface WebcamProvider {
  discoverByBoundingBox(bbox: BoundingBox, limit?: number): Promise<Camera[]>;
  getCamera(id: string): Promise<Camera | null>;
  getCameras(ids: string[]): Promise<Camera[]>;
}
