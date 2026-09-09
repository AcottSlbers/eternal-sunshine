import type { Camera, CameraAttribution } from "@/types/camera";

export const METEOGALICIA_ATTRIBUTION: CameraAttribution = {
  name: "MeteoGalicia / Xunta de Galicia",
  url: "https://www.meteogalicia.gal/web/observacion/camaras",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export function getCameraAttribution(camera: Pick<Camera, "source" | "sourceUrl" | "attribution">): CameraAttribution {
  if (camera.attribution) return camera.attribution;
  if (camera.source === "meteogalicia") return METEOGALICIA_ATTRIBUTION;
  return { name: camera.source === "windy" ? "Windy Webcams" : "Development fixture", url: camera.sourceUrl ?? "https://www.windy.com/webcams" };
}
