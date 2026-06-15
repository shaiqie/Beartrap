import type { Awaitable, ClientEvents } from "discord.js";
import type { AppContext } from "../core/AppContext";

export interface EventModule<K extends keyof ClientEvents = keyof ClientEvents> {
  readonly name: K;
  readonly once?: boolean;
  execute(ctx: AppContext, ...args: ClientEvents[K]): Awaitable<void>;
}

export interface LoadedEvent {
  readonly name: keyof ClientEvents;
  readonly domain: string;
  readonly folderName: string;
  readonly filePath: string;
  readonly module: EventModule;
}
