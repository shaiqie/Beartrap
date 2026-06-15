import type { Database } from "bun:sqlite";
import type { Client } from "discord.js";
import type { BrandingConfig } from "../config/branding";
import type { Env } from "../config/env";
import type { CommandHandler } from "../handlers/CommandHandler";
import type { GuildConfigService } from "../services/config/GuildConfigService";
import type { GhostNetworkService } from "../services/ghost/GhostNetworkService";
import type { LinkIntelService } from "../services/intel/LinkIntelService";
import type { SecurityEvaluator } from "../services/security/SecurityEvaluator";
import type { TarPitService } from "../services/tarpit/TarPitService";
import type { ScrapeTelemetryService } from "../services/telemetry/ScrapeTelemetryService";
import type { WelcomeService } from "../services/welcome/WelcomeService";

export interface AppServices {
  readonly guildConfig: GuildConfigService;
  readonly ghostNetwork: GhostNetworkService;
  readonly linkIntel: LinkIntelService;
  readonly securityEvaluator: SecurityEvaluator;
  readonly tarPit: TarPitService;
  readonly scrapeTelemetry: ScrapeTelemetryService;
  readonly welcome: WelcomeService;
}

export interface AppContext {
  readonly client: Client;
  readonly branding: BrandingConfig;
  readonly db: Database;
  readonly env: Env;
  readonly startedAt: number;
  readonly commands: CommandHandler;
  readonly services: AppServices;
}
