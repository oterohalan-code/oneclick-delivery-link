import { describe, expect, test } from "bun:test";
import { isAllowedGoogleMapsUrl, parseGoogleMapsLink } from "./maps";

describe("Shared delivery pins", () => {
  test("extracts the confirmed El Güero search pin", () => {
    expect(parseGoogleMapsLink("https://www.google.com/maps/search/19.127665,+-104.328263")).toEqual({ url: "https://www.google.com/maps/search/19.127665,+-104.328263", lat: 19.127665, lng: -104.328263 });
  });
  test("preserves a short link until it is resolved", () => {
    expect(parseGoogleMapsLink("https://maps.app.goo.gl/NweKv6mXZBozjn9d7")?.lat).toBeNull();
  });
  test("uses the destination pin instead of the viewport", () => {
    const parsed = parseGoogleMapsLink("https://www.google.com/maps/place/Casa/@19.1,-104.3,14z/data=!3d19.127665!4d-104.328263");
    expect(parsed?.lat).toBe(19.127665);
    expect(parsed?.lng).toBe(-104.328263);
  });
  test("decodes coordinate query parameters", () => {
    expect(parseGoogleMapsLink("https://www.google.com/maps?q=19.127665%2C-104.328263")?.lng).toBe(-104.328263);
  });
  test("rejects off-provider redirects and invalid coordinates", () => {
    for (const url of ["https://www.google.com.attacker.com/maps", "https://google.evil/maps", "https://google.com/maps@evil.com", "https://user:pass@google.com/maps", "https://maps.app.goo.gl:8080/test", "https://127.0.0.1/maps"]) expect(isAllowedGoogleMapsUrl(url)).toBe(false);
    expect(parseGoogleMapsLink("https://google.com/maps?q=190,-104")).toBeNull();
  });
});