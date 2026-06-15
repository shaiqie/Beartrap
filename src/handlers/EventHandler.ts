import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import type { AppContext } from "../core/AppContext";
import { logger } from "../core/logger";
import type { EventModule, LoadedEvent } from "../types/Event";

export class EventHandler {
  private readonly events: LoadedEvent[] = [];

  public constructor(private readonly sourceRoot: string) {}

  public async load(): Promise<void> {
    this.events.length = 0;

    const glob = new Bun.Glob("events/*/*/index.ts");
    for await (const relativePath of glob.scan({ cwd: this.sourceRoot, onlyFiles: true })) {
      const filePath = join(this.sourceRoot, relativePath);
      const file = Bun.file(filePath);
      if (!(await file.exists())) continue;

      const imported = (await import(pathToFileURL(filePath).href)) as {
        default?: EventModule;
        event?: EventModule;
      };
      const event = imported.default ?? imported.event;

      if (!event?.name || typeof event.execute !== "function") {
        logger.warn("Skipping invalid event module.", { filePath });
        continue;
      }

      const parts = relativePath.split(/[\\/]/);
      const domain = parts[1];
      const folderName = parts[2];
      if (!domain || !folderName) {
        logger.warn("Skipping event with invalid path shape.", { relativePath });
        continue;
      }

      this.events.push({
        name: event.name,
        domain,
        folderName,
        filePath,
        module: event
      });
    }

    logger.info("Loaded event modules.", {
      count: this.events.length
    });
  }

  public register(client: Client, ctx: AppContext): void {
    for (const loaded of this.events) {
      const listener = async (...args: unknown[]) => {
        try {
          const execute = loaded.module.execute as (context: AppContext, ...eventArgs: unknown[]) => unknown;
          await execute(ctx, ...args);
        } catch (error) {
          logger.error("Event handler failed.", {
            event: String(loaded.name),
            filePath: loaded.filePath,
            error
          });
        }
      };

      if (loaded.module.once) {
        client.once(loaded.name, listener);
      } else {
        client.on(loaded.name, listener);
      }
    }
  }
}
