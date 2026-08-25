import { describe, expect, it } from "vitest";
import { WindyConfigurationError, WindyWebcamProvider, normalizeWindyWebcam } from "../lib/providers/windy-webcam-provider";

describe("Windy provider", () => {
  it("fails clearly when the API key is missing", () => {
    expect(() => new WindyWebcamProvider("")).toThrow(WindyConfigurationError);
  });

  it("normalizes a documented V3 webcam response", () => {
    const camera = normalizeWindyWebcam({ webcamId: 42, status: "active", title: "Ocean View", viewCount: 1000, lastUpdatedOn: "2026-08-25T12:00:00Z", categories: [{ id: "beach", name: "Beach" }], images: { current: { icon: "https://example.test/image.jpg" }, sizes: { icon: { width: 320, height: 180 } } }, location: { country: "Portugal", region: "Madeira", latitude: 32.65, longitude: -16.9 }, urls: { detail: "https://www.windy.com/webcams/42" } });
    expect(camera).toMatchObject({ id: "42", source: "windy", enabled: true, latitude: 32.65, longitude: -16.9, country: "Portugal", lastKnownImageUrl: "https://example.test/image.jpg" });
  });

  it("drops malformed coordinates", () => {
    expect(normalizeWindyWebcam({ webcamId: 42, location: { latitude: 999, longitude: 0 } })).toBeNull();
  });
});
