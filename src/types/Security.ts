export type BaitTargetType = "user" | "webhook";
export type SecurityAction = "ignore" | "bypass" | "contain";
export type SecuritySeverity = "none" | "low" | "medium" | "high" | "critical";

export interface GuildConfig {
  readonly guildId: string;
  readonly adminLogChannelId: string | null;
  readonly quarantineRoleId: string | null;
  readonly quarantineCategoryId: string | null;
  readonly ghostCategoryId: string | null;
  readonly ghostCount: number;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GhostChannelRecord {
  readonly guildId: string;
  readonly channelId: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface BaitTarget {
  readonly guildId: string;
  readonly targetType: BaitTargetType;
  readonly targetId: string;
  readonly createdAt: string;
}

export interface TrappedMemberRecord {
  readonly guildId: string;
  readonly userId: string;
  readonly tarpitChannelId: string;
  readonly quarantinedAt: string;
  readonly releasedAt: string | null;
}

export interface RedirectFinding {
  readonly sourceUrl: string;
  readonly parameter: string;
  readonly decodedTarget: string;
}

export interface LinkIntel {
  readonly urls: string[];
  readonly hosts: string[];
  readonly redirects: RedirectFinding[];
  readonly malformed: string[];
}

export interface SecurityInput {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly content: string;
  readonly createdAt: number;
  readonly joinedAt: number | null;
  readonly isGhostChannel: boolean;
  readonly mentionedUserIds: readonly string[];
  readonly baitTargets: readonly BaitTarget[];
  readonly webhookId: string | null;
  readonly linkIntel: LinkIntel;
}

export interface SecurityEvidence {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly joinedAt: number | null;
  readonly createdAt: number;
  readonly deltaMs: number | null;
  readonly isGhostChannel: boolean;
  readonly baitTargetIds: string[];
  readonly mentionedUserIds: string[];
  readonly webhookId: string | null;
  readonly linkIntel: LinkIntel;
  readonly contentSample: string;
}

export interface SecurityEvaluation {
  readonly action: SecurityAction;
  readonly severity: SecuritySeverity;
  readonly score: number;
  readonly reasons: string[];
  readonly botSignals: string[];
  readonly humanSignals: string[];
  readonly evidence: SecurityEvidence;
}
