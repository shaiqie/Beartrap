import { describe, expect, test } from "bun:test";
import { decodeRedirects } from "../src/functions/urls/decodeRedirects";
import { extractUrls } from "../src/functions/urls/extractUrls";
import { LinkIntelService } from "../src/services/intel/LinkIntelService";

describe("URL utilities", () => {
  test("extracts unique HTTP URLs and strips trailing punctuation", () => {
    expect(
      extractUrls("go https://example.com/path), then https://example.com/path and http://x.test/a.")
    ).toEqual(["https://example.com/path", "http://x.test/a"]);
  });

  test("decodes redirect parameters without network access", () => {
    const findings = decodeRedirects([
      "https://safe.test/leave?url=https%3A%2F%2Fevil.test%2Flogin",
      "https://safe.test/nope?x=1"
    ]);

    expect(findings).toEqual([
      {
        sourceUrl: "https://safe.test/leave?url=https%3A%2F%2Fevil.test%2Flogin",
        parameter: "url",
        decodedTarget: "https://evil.test/login"
      }
    ]);
  });

  test("link intel summarizes hosts and redirects", () => {
    const intel = new LinkIntelService().analyze(
      "claim https://safe.test/r?target=https%3A%2F%2Fphish.test%2F"
    );

    expect(intel.urls).toHaveLength(1);
    expect(intel.hosts).toEqual(["safe.test"]);
    expect(intel.redirects[0]?.decodedTarget).toBe("https://phish.test/");
  });
});
