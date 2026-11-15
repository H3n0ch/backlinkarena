import { describe, expect, it } from "vitest";
import { arenaHosts, badgeFormats, findBacklink } from "./badge";

const hosts = arenaHosts("http://localhost:3001");

describe("findBacklink", () => {
  it("finds a dofollow badge link", () => {
    const html = `<footer><a href="https://backlinkarena.com/p/acme" target="_blank"><img src="x"></a></footer>`;
    expect(findBacklink(html, "https://acme.com", hosts)).toMatchObject({ found: true, dofollow: true });
  });
  it("accepts www and single-quoted attributes", () => {
    const html = `<a class='x' href='https://www.backlinkarena.com/'>BA</a>`;
    expect(findBacklink(html, "https://acme.com", hosts).dofollow).toBe(true);
  });
  it("flags nofollow / sponsored / ugc links", () => {
    for (const rel of ["nofollow", "noopener sponsored", "UGC"]) {
      const html = `<a rel="${rel}" href="https://backlinkarena.com/p/acme">x</a>`;
      expect(findBacklink(html, "https://acme.com", hosts)).toMatchObject({ found: true, dofollow: false });
    }
  });
  it("prefers a dofollow link when both exist", () => {
    const html = `<a rel="nofollow" href="https://backlinkarena.com">a</a><a href="https://backlinkarena.com/p/acme">b</a>`;
    expect(findBacklink(html, "https://acme.com", hosts).dofollow).toBe(true);
  });
  it("ignores look-alike domains and missing links", () => {
    const html = `<a href="https://backlinkarena.com.evil.io/">x</a><a href="/about">y</a>`;
    expect(findBacklink(html, "https://acme.com", hosts).found).toBe(false);
  });
});

describe("badgeFormats", () => {
  it("builds html, text and markdown pointing at the product page", () => {
    const f = badgeFormats("https://backlinkarena.com", "acme-com", "dark");
    expect(f.html).toContain('href="https://backlinkarena.com/p/acme-com"');
    expect(f.html).toContain("featured-dark.svg");
    expect(f.html).not.toContain("nofollow");
    expect(f.markdown).toBe(
      "[![Featured on Backlink Arena](https://backlinkarena.com/badge/featured-dark.svg)](https://backlinkarena.com/p/acme-com)",
    );
  });
});
