import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandHandler } from "../src/handlers/CommandHandler";

let tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  tempRoots = [];
});

describe("CommandHandler", () => {
  test("detects command category from folder name", async () => {
    const root = mkdtempSync(join(tmpdir(), "beartrap-command-"));
    tempRoots.push(root);

    const commandDir = join(root, "commands", "moderation", "ban");
    mkdirSync(commandDir, { recursive: true });
    await Bun.write(
      join(commandDir, "index.ts"),
      `
        export default {
          data: {
            name: "ban",
            toJSON() {
              return { name: "ban", description: "test", type: 1 };
            }
          },
          async execute() {}
        };
      `
    );

    const handler = new CommandHandler(root);
    await handler.load();

    expect(handler.get("ban")?.category).toBe("moderation");
    expect(handler.getCategories()).toEqual(new Set(["moderation"]));
  });
});
