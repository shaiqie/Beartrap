import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadBranding } from "./config/branding";
import { loadEnv } from "./config/env";
import type { AppContext } from "./core/AppContext";
import { logger } from "./core/logger";
import { CommandHandler } from "./handlers/CommandHandler";
import { EventHandler } from "./handlers/EventHandler";
import { GuildConfigService } from "./services/config/GuildConfigService";
import { GhostNetworkService } from "./services/ghost/GhostNetworkService";
import { LinkIntelService } from "./services/intel/LinkIntelService";
import { SecurityEvaluator } from "./services/security/SecurityEvaluator";
import { TarPitService } from "./services/tarpit/TarPitService";
import { ScrapeTelemetryService } from "./services/telemetry/ScrapeTelemetryService";
import { WelcomeService } from "./services/welcome/WelcomeService";
import { migrate } from "./storage/schema";

async function main(): Promise<void> {
  const env = loadEnv();
  const branding = loadBranding();
  mkdirSync(dirname(env.databasePath), { recursive: true });

  const db = new Database(env.databasePath, { create: true });
  migrate(db);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
  });

  const commands = new CommandHandler(import.meta.dir);
  await commands.load();

  const guildConfig = new GuildConfigService(db);
  const ghostNetwork = new GhostNetworkService(guildConfig);
  const linkIntel = new LinkIntelService();
  const securityEvaluator = new SecurityEvaluator();
  const tarPit = new TarPitService(guildConfig);
  const scrapeTelemetry = new ScrapeTelemetryService();
  const welcome = new WelcomeService(branding);

  const ctx: AppContext = {
    client,
    branding,
    db,
    env,
    startedAt: Date.now(),
    commands,
    services: {
      guildConfig,
      ghostNetwork,
      linkIntel,
      securityEvaluator,
      tarPit,
      scrapeTelemetry,
      welcome
    }
  };

  const events = new EventHandler(import.meta.dir);
  await events.load();
  events.register(client, ctx);

  process.on("SIGINT", () => {
    logger.info("Received SIGINT; shutting down Beartrap.");
    db.close();
    client.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM; shutting down Beartrap.");
    db.close();
    client.destroy();
    process.exit(0);
  });

  await client.login(env.discordToken);
}

main().catch((error: unknown) => {
  logger.error("Beartrap failed to start.", { error });
  process.exit(1);
});
