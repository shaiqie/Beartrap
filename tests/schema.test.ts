import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { GuildConfigService } from "../src/services/config/GuildConfigService";
import { migrate } from "../src/storage/schema";

describe("SQLite schema", () => {
  test("migrates and stores guild config state", () => {
    const db = new Database(":memory:");
    migrate(db);

    const service = new GuildConfigService(db);
    const created = service.getOrCreateGuildConfig("guild-1");
    expect(created.enabled).toBe(false);

    const updated = service.updateGuildConfig("guild-1", {
      enabled: true,
      ghostCount: 5,
      adminLogChannelId: "log-1"
    });

    expect(updated.enabled).toBe(true);
    expect(updated.ghostCount).toBe(5);
    expect(service.countEnabledGuilds()).toBe(1);

    db.close();
  });
});
