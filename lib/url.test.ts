import { describe, expect, it } from "vitest";
import { cleanRef, normalizeUrl, safeHttpUrl, slugify } from "./url";
import { roundName } from "./time";

describe("normalizeUrl", () => {
  it("adds https and strips path, query, hash, www", () => {
    expect(normalizeUrl("www.Example.com/pricing?utm_source=x#top")).toEqual({
      url: "https://example.com",
      domain: "example.com",
    });
  });
  it("keeps subdomains other than www", () => {
    expect(normalizeUrl("http://app.example.io")?.domain).toBe("app.example.io");
  });
  it("rejects garbage, IPs and credentials", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
    expect(normalizeUrl("http://127.0.0.1")).toBeNull();
    expect(normalizeUrl("https://user:pw@example.com")).toBeNull();
  });
});

describe("slugify", () => {
  it("turns domains into slugs", () => {
    expect(slugify("app.example.io")).toBe("app-example-io");
  });
});

describe("cleanRef", () => {
  it("accepts slugs only", () => {
    expect(cleanRef("acme-com")).toBe("acme-com");
    expect(cleanRef("<script>")).toBeNull();
    expect(cleanRef(undefined)).toBeNull();
  });
});

describe("safeHttpUrl", () => {
  it("rejects javascript urls", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https://a.com/x.png")).toBe("https://a.com/x.png");
  });
});

describe("roundName", () => {
  it("names rounds for a 16 bracket", () => {
    expect([1, 2, 3, 4].map((r) => roundName(r, 16))).toEqual([
      "Round of 16",
      "Quarterfinals",
      "Semifinals",
      "Final",
    ]);
  });
});
