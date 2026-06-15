import type {
  BaitTarget,
  SecurityEvaluation,
  SecurityEvidence,
  SecurityInput,
  SecuritySeverity
} from "../../types/Security";

const HUMAN_PHRASES = [
  "wait what is this",
  "wait, what is this",
  "what is this",
  "why can i see this",
  "is this channel supposed to be here",
  "am i supposed to see this",
  "oops",
  "wrong channel",
  "i can see this"
];

const AUTOMATION_PHRASES = [
  "free nitro",
  "steam gift",
  "airdrop",
  "claim now",
  "verify your account",
  "wallet connect",
  "discord gift",
  "limited time",
  "urgent verify"
];

export class SecurityEvaluator {
  public evaluate(input: SecurityInput): SecurityEvaluation {
    const deltaMs = input.joinedAt === null ? null : Math.max(0, input.createdAt - input.joinedAt);
    const contentSample = input.content.replace(/\s+/g, " ").trim().slice(0, 500);
    const baitTargetIds = this.findBaitHits(input.baitTargets, input.mentionedUserIds, input.webhookId, input.content);
    const humanSignals = this.findHumanSignals(input.content, deltaMs, input.linkIntel.urls.length);
    const botSignals: string[] = [];
    const reasons: string[] = [];
    let score = 0;

    if (input.isGhostChannel) {
      score += 80;
      botSignals.push("ghost_channel_interaction");
      reasons.push("Message landed in a configured ghost channel.");
    }

    if (deltaMs !== null && deltaMs <= 1_000) {
      score += 70;
      botSignals.push("sub_second_join_to_message");
      reasons.push(`Join-to-message delta was ${deltaMs}ms.`);
    } else if (deltaMs !== null && deltaMs <= 5_000) {
      score += 40;
      botSignals.push("fast_join_to_message");
      reasons.push(`Join-to-message delta was ${deltaMs}ms.`);
    }

    if (baitTargetIds.length > 0) {
      score += 55;
      botSignals.push("bait_target_hit");
      reasons.push(`Message targeted bait IDs: ${baitTargetIds.join(", ")}.`);
    }

    if (input.linkIntel.urls.length > 0) {
      score += 30;
      botSignals.push("url_payload");
      reasons.push(`Message included ${input.linkIntel.urls.length} URL(s).`);
    }

    if (/@everyone|@here/i.test(input.content) || input.mentionedUserIds.length >= 4) {
      score += 20;
      botSignals.push("mass_mention");
      reasons.push("Message used mass-mention behavior.");
    }

    const normalized = this.normalize(input.content);
    for (const phrase of AUTOMATION_PHRASES) {
      if (normalized.includes(phrase)) {
        score += 20;
        botSignals.push("known_lure_phrase");
        reasons.push(`Message matched lure phrase: ${phrase}.`);
        break;
      }
    }

    const hasHumanBypass =
      humanSignals.length > 0 &&
      input.linkIntel.urls.length === 0 &&
      baitTargetIds.length === 0 &&
      input.isGhostChannel &&
      (deltaMs === null || deltaMs > 750);

    if (hasHumanBypass) {
      score = Math.max(0, score - 75);
      reasons.push("Human-like confusion signal with no payload links or bait targeting.");
    }

    const evidence: SecurityEvidence = {
      guildId: input.guildId,
      userId: input.userId,
      channelId: input.channelId,
      joinedAt: input.joinedAt,
      createdAt: input.createdAt,
      deltaMs,
      isGhostChannel: input.isGhostChannel,
      baitTargetIds,
      mentionedUserIds: [...input.mentionedUserIds],
      webhookId: input.webhookId,
      linkIntel: input.linkIntel,
      contentSample
    };

    if (hasHumanBypass) {
      return {
        action: "bypass",
        severity: "low",
        score,
        reasons,
        botSignals,
        humanSignals,
        evidence
      };
    }

    const severity = this.severityForScore(score);
    const action = score >= 80 ? "contain" : "ignore";

    return {
      action,
      severity,
      score,
      reasons,
      botSignals,
      humanSignals,
      evidence
    };
  }

  private findHumanSignals(content: string, deltaMs: number | null, urlCount: number): string[] {
    const normalized = this.normalize(content);
    const signals: string[] = [];

    for (const phrase of HUMAN_PHRASES) {
      if (normalized.includes(phrase)) {
        signals.push(`human_phrase:${phrase}`);
        break;
      }
    }

    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    if (urlCount === 0 && wordCount >= 3 && wordCount <= 18 && /[?]/.test(content)) {
      signals.push("short_question_no_payload");
    }

    if (deltaMs !== null && deltaMs > 2_500 && urlCount === 0) {
      signals.push("human_typing_window");
    }

    return signals;
  }

  private findBaitHits(
    baitTargets: readonly BaitTarget[],
    mentionedUserIds: readonly string[],
    webhookId: string | null,
    content: string
  ): string[] {
    const mentioned = new Set(mentionedUserIds);
    const hits: string[] = [];

    for (const target of baitTargets) {
      if (target.targetType === "user" && mentioned.has(target.targetId)) {
        hits.push(target.targetId);
        continue;
      }

      if (target.targetType === "webhook") {
        if (target.targetId === webhookId || content.includes(target.targetId)) {
          hits.push(target.targetId);
        }
      }
    }

    return hits;
  }

  private severityForScore(score: number): SecuritySeverity {
    if (score >= 140) return "critical";
    if (score >= 100) return "high";
    if (score >= 70) return "medium";
    if (score > 0) return "low";
    return "none";
  }

  private normalize(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
