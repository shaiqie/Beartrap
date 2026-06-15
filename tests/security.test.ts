import { describe, expect, test } from "bun:test";
import { SecurityEvaluator } from "../src/services/security/SecurityEvaluator";
import type { SecurityInput } from "../src/types/Security";

const emptyIntel = {
  urls: [],
  hosts: [],
  redirects: [],
  malformed: []
};

function input(overrides: Partial<SecurityInput>): SecurityInput {
  return {
    guildId: "1",
    userId: "2",
    channelId: "3",
    content: "hello",
    createdAt: 10_000,
    joinedAt: 9_000,
    isGhostChannel: false,
    mentionedUserIds: [],
    baitTargets: [],
    webhookId: null,
    linkIntel: emptyIntel,
    ...overrides
  };
}

describe("SecurityEvaluator", () => {
  test("contains high-confidence ghost URL activity", () => {
    const result = new SecurityEvaluator().evaluate(
      input({
        isGhostChannel: true,
        content: "claim https://evil.test",
        linkIntel: {
          urls: ["https://evil.test"],
          hosts: ["evil.test"],
          redirects: [],
          malformed: []
        }
      })
    );

    expect(result.action).toBe("contain");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.botSignals).toContain("ghost_channel_interaction");
    expect(result.botSignals).toContain("url_payload");
  });

  test("bypasses human confusion in a ghost channel when no payload exists", () => {
    const result = new SecurityEvaluator().evaluate(
      input({
        isGhostChannel: true,
        content: "wait, what is this?",
        createdAt: 13_000,
        joinedAt: 9_000
      })
    );

    expect(result.action).toBe("bypass");
    expect(result.severity).toBe("low");
    expect(result.humanSignals.length).toBeGreaterThan(0);
  });

  test("scores fast bait mentions", () => {
    const result = new SecurityEvaluator().evaluate(
      input({
        content: "<@999> verify now",
        mentionedUserIds: ["999"],
        baitTargets: [{ guildId: "1", targetType: "user", targetId: "999", createdAt: "now" }],
        createdAt: 10_000,
        joinedAt: 9_500
      })
    );

    expect(result.action).toBe("contain");
    expect(result.botSignals).toContain("bait_target_hit");
  });
});
