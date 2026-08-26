import { describe, expect, it } from "vitest";
import { WindyConfigurationError, WindyWebcamProvider, normalizeWindyLivePlayer, normalizeWindyWebcam } from "../lib/providers/windy-webcam-provider";

describe("Windy provider", () => {
  it("fails clearly when the API key is missing", () => {
    expect(() => new WindyWebcamProvider("")).toThrow(WindyConfigurationError);
  });

  it("normalizes a documented V3 webcam response", () => {
    const camera = normalizeWindyWebcam({ webcamId: 42, status: "active", title: "Ocean View", viewCount: 1000, lastUpdatedOn: "2026-08-25T12:00:00Z", categories: [{ id: "beach", name: "Beach" }], images: { current: { icon: "https://example.test/image.jpg" }, sizes: { icon: { width: 320, height: 180 } } }, location: { country: "Portugal", region: "Madeira", latitude: 32.65, longitude: -16.9 }, urls: { detail: "https://www.windy.com/webcams/42" } });
    expect(camera).toMatchObject({ id: "42", source: "windy", enabled: true, latitude: 32.65, longitude: -16.9, country: "Portugal", lastKnownImageUrl: "https://example.test/image.jpg", hasLiveStream: false });
    expect(camera?.livePlayer).toBeUndefined();
  });

  it("normalizes the provider URL independently of live support", () => {
    const camera = normalizeWindyWebcam({ webcamId: 43, status: "active", location: { latitude: 1, longitude: 2 }, urls: { detail: "https://windy.com/webcams/43", provider: "https://provider.example/camera" } });
    expect(camera).toMatchObject({ providerUrl: "https://provider.example/camera", hasLiveStream: false });
  });

  it("normalizes the real V3 live string as a Windy iframe", () => {
    const camera = normalizeWindyWebcam({ webcamId: 44, status: "active", location: { latitude: 1, longitude: 2 }, player: { live: "https://webcams.windy.com/webcams/public/embed/player/44/live" } });
    expect(camera).toMatchObject({ hasLiveStream: true, livePlayer: { type: "windy-iframe", url: "https://webcams.windy.com/webcams/public/embed/player/44/live", embedUrl: "https://webcams.windy.com/webcams/public/embed/player/44/live" } });
  });

  it("handles a missing player field as snapshot-only", () => {
    const camera = normalizeWindyWebcam({ webcamId: 45, status: "active", location: { latitude: 1, longitude: 2 } });
    expect(camera?.hasLiveStream).toBe(false);
  });

  it("ignores unexpected optional live metadata without invalidating the webcam", () => {
    const camera = normalizeWindyWebcam({ webcamId: 46, status: "active", location: { latitude: 1, longitude: 2 }, player: { live: { embed: "not-the-v3-shape" } }, urls: { provider: 123 } });
    expect(camera).not.toBeNull();
    expect(camera).toMatchObject({ hasLiveStream: false });
    expect(camera?.providerUrl).toBeUndefined();
    expect(normalizeWindyLivePlayer({ live: "javascript:alert(1)" })).toBeUndefined();
  });

  it("drops malformed coordinates", () => {
    expect(normalizeWindyWebcam({ webcamId: 42, location: { latitude: 999, longitude: 0 } })).toBeNull();
  });
});
