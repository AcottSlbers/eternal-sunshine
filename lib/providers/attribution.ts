import { PROVIDERS } from "@/lib/providers/catalogue";
import type { Camera, CameraAttribution } from "@/types/camera";

export const METEOGALICIA_ATTRIBUTION: CameraAttribution = {
  name: "MeteoGalicia / Xunta de Galicia",
  url: "https://www.meteogalicia.gal/web/observacion/camaras",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export function getCameraAttribution(camera: Pick<Camera, "source" | "sourceUrl" | "attribution">): CameraAttribution {
  if (camera.attribution) return camera.attribution;
  return PROVIDERS[camera.source].attribution;
}
