export interface Env {
  readonly discordToken: string;
  readonly clientId: string;
  readonly databasePath: string;
}

export function loadEnv(source: Record<string, string | undefined> = Bun.env): Env {
  const discordToken = source.DISCORD_TOKEN ?? "";
  const clientId = source.CLIENT_ID ?? "";
  const databasePath = source.DATABASE_PATH ?? "./data/beartrap.sqlite";

  const missing: string[] = [];
  if (!discordToken) missing.push("DISCORD_TOKEN");
  if (!clientId) missing.push("CLIENT_ID");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    discordToken,
    clientId,
    databasePath
  };
}
