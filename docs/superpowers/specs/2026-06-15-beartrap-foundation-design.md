# Beartrap Foundational Architecture Design

Date: 2026-06-15

## Goal

Build Beartrap, a modular, fast, ultra-lightweight Discord security bot written in strict TypeScript for the Bun runtime. Beartrap must be distributable across many guilds without per-guild environment edits. Server admins should be able to install the bot, run `/setup`, configure security surfaces through Discord-native prompts, and receive quiet, professional security logging.

## Non-Goals and Discord API Limits

Beartrap cannot detect a member merely viewing a channel because Discord does not expose channel-view events to bots. Beartrap also cannot make a channel hidden by permissions while still visible to normal raw user clients; Discord permission evaluation still governs channel visibility.

The design handles these limits by implementing production-safe honeypots that trigger on observable guild events, while keeping a pluggable scrape telemetry adapter for future external signals. Direct outbound URL fetching, DNS lookups, PhishTank submission, and Cloudflare reporting are out of scope for the foundation. Link intelligence is passive only.

## Chosen Approach

Use a service container plus dynamic event and command modules. `AppContext` owns shared dependencies: Discord client, SQLite database, config service, ghost network service, evaluator, tar-pit service, link intel service, and scrape telemetry service. Event handlers stay thin and call services. This keeps the bot scalable without turning each feature into a heavy plugin system.

## Runtime and Dependencies

The bot runs with Bun only:

- `bun run dev`
- `bun run start`
- `bun test`
- `bun run typecheck`

Core dependencies:

- `discord.js` latest compatible version
- `typescript`
- Bun SQLite via `bun:sqlite`

Environment variables:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `DATABASE_PATH`, defaulting to `./data/beartrap.sqlite`

Guild-specific configuration lives in SQLite, not environment variables.

## Project Structure

The project uses feature folders so commands, events, and functions have their own dedicated directories.

```text
src/
  index.ts
  config/
    env.ts
  core/
    AppContext.ts
    logger.ts
  handlers/
    CommandHandler.ts
    EventHandler.ts
  commands/
    admin/
      status/
        index.ts
      setup/
        index.ts
  events/
    client/
      ready/
        index.ts
    guild/
      guildCreate/
        index.ts
      guildMemberAdd/
        index.ts
      messageCreate/
        index.ts
    interaction/
      interactionCreate/
        index.ts
  functions/
    discord/
      embeds.ts
      permissions.ts
    urls/
      extractUrls.ts
      decodeRedirects.ts
    time/
      now.ts
  services/
    config/
      GuildConfigService.ts
    ghost/
      GhostNetworkService.ts
    security/
      SecurityEvaluator.ts
    tarpit/
      TarPitService.ts
    intel/
      LinkIntelService.ts
    telemetry/
      ScrapeTelemetryService.ts
  storage/
    schema.ts
  types/
    Command.ts
    Event.ts
    Security.ts
```

## Dynamic Loading

`CommandHandler` scans `src/commands/*/*/index.ts`. The first folder under `commands` is the command category. For example:

```text
src/commands/moderation/ban/index.ts
```

is automatically detected as category `moderation` with command module `ban`. No core infrastructure edit is required when adding new command categories.

`EventHandler` scans `src/events/*/*/index.ts`. The event module exports the Discord event name, whether it runs once, and an async execute function. Event folders group handlers by domain, such as `guild`, `client`, and `interaction`.

## Setup UX

Beartrap is designed for distribution. Admins configure guild settings through `/setup`, not environment variables.

`/setup init` replies with an ephemeral embed and action buttons:

- `Auto-create`
- `Manual setup`
- `Review config`

Manual setup uses Discord-native selects where possible:

- channel select for the admin log channel
- role select for the quarantine role
- channel/category select for quarantine and ghost categories
- user select for bait users
- modal text inputs for webhook IDs and numeric ghost count

Modals are used only where free-form text is required. This keeps setup easy and avoids forcing admins to copy IDs for channels, roles, and users.

Setup command surface:

```text
/setup init
/setup logs channel:#channel
/setup quarantine role:@role category:#category
/setup ghosts category:#category count:3 rotate:true
/setup bait add-user:@user
/setup bait add-webhook id:<webhook_id>
/setup bait list
/setup status
/setup reset
```

Setup commands require `ManageGuild`. Runtime checks also validate Beartrap's own permissions for role management and channel management.

## Data Model

SQLite tables:

```text
guild_configs
  guild_id primary
  admin_log_channel_id
  quarantine_role_id
  quarantine_category_id
  ghost_category_id
  ghost_count
  enabled
  created_at
  updated_at

ghost_channels
  guild_id
  channel_id
  name
  category_id
  active
  created_at

bait_targets
  guild_id
  target_type: user|webhook
  target_id
  created_at

member_join_events
  guild_id
  user_id
  joined_at
  created_at

trap_events
  id
  guild_id
  user_id
  channel_id
  severity
  reason
  evidence_json
  created_at

trapped_members
  guild_id
  user_id
  tarpit_channel_id
  quarantined_at
  released_at nullable
```

Hot caches mirror guild config, ghost channel IDs, bait target IDs, and recent join timestamps for speed. SQLite remains the source of truth.

## Ghost Network

`GhostNetworkService` manages realistic ghost channels under configured categories. Channel names are randomized from a realistic pool, including names such as:

- `announcements-2`
- `general-chat`
- `verify-here`
- `rules-info`
- `community-updates`

Ghost channels are configured with strict permission overwrites:

- deny `ViewChannel` for `@everyone`
- deny `ViewChannel` for configured human roles when known
- allow Beartrap to view and manage the channels

Ghost channels are tracked in SQLite. A setup or resync flow recreates missing channels and can rotate names. Observable activity in a ghost channel is a high-confidence signal because legitimate members should not be able to interact there.

## Behavioral Honeypot: Mimic

Beartrap monitors guild-visible telemetry around bait users and webhook IDs. On `guildMemberAdd`, it records the member's join timestamp. On `messageCreate`, it evaluates whether the member quickly mentioned, tagged, linked, or otherwise targeted configured bait surfaces.

The default high-risk threshold is any bait-targeting message within five seconds of joining, especially when paired with links, mass mentions, or bot-like content. This value is configurable later, but fixed in the foundation.

## Typographic Profile Honeypot

`SecurityEvaluator` reduces false positives before containment. It evaluates:

- time elapsed between join and message
- whether the channel is a ghost channel
- whether bait targets were mentioned
- whether URLs were posted
- whether message content looks automated
- whether message content looks human and confused

Human-like bypass examples include conversational strings such as:

- `wait what is this`
- `why can i see this`
- `is this channel supposed to be here`
- `oops`

If the event looks human and low-risk, Beartrap does not quarantine. It hides the channel from the member with a member-specific overwrite, sends a polite warning DM, and logs a low-risk admin event.

## Tar-Pit Quarantine

High-confidence detections call `TarPitService.contain(member, reason, evidence)`.

Containment steps:

1. Remove authentic identity roles when Beartrap can safely manage them.
2. Skip managed roles, `@everyone`, roles equal or higher than the bot's highest role, and the quarantine role.
3. Add the configured quarantine role.
4. Create or reuse a private text channel under the quarantine category.
5. Deny `ViewChannel` to `@everyone`.
6. Allow only the trapped member and Beartrap to view/send messages.
7. Send a neutral success-like message in the tar-pit channel.
8. Log the evidence to the admin channel with a clean embed.

Tar-pit user-facing message:

> Message received. Some server checks are still catching up, so replies may look delayed.

Beartrap does not ban or kick in the foundation. The containment action is quiet and reversible.

## Link Intelligence

`LinkIntelService` extracts URLs from message content and decodes common redirect parameters without network access. It records:

- raw URLs
- hostnames when parseable
- decoded redirect targets from parameters such as `url`, `u`, `redirect`, `redirect_uri`, `target`, and `to`
- parse errors when malformed URLs are present

The admin embed includes the passive link report for later review or external reporting.

## Scrape Telemetry Adapter

`ScrapeTelemetryService` exposes an internal interface for future external scrape-footprint events. The foundation implementation is a no-op in production and can accept synthetic events in tests. This preserves the "Ghost Network" concept without pretending Discord exposes non-existent view telemetry.

## Admin Embeds and Tone

Embeds are minimalist and professional with a small amount of personality.

Setup intro:

> Hey there, I'm Beartrap. I help catch suspicious automation quietly, log useful evidence, and keep normal members out of the crossfire. Let's wire the traps.

Human false-positive DM:

> Hey, quick heads-up from Beartrap. You touched a restricted security channel, so I quietly hid it from you. Nothing else happened. If this feels wrong, contact a server admin.

Admin high-confidence flag:

> Beartrap caught a high-confidence automation signal. No public action was taken; the member was contained quietly.

`/status` displays:

- gateway ping
- uptime
- guild count
- enabled guild config status
- ghost channel count
- currently trapped member count
- recent trap count
- command category count

## Event Flow

Startup:

1. Load env.
2. Open SQLite.
3. Run schema migrations.
4. Build `AppContext`.
5. Dynamically load commands and events.
6. Login Discord client.
7. On ready, register slash commands per joined guild.

Guild join:

1. Register commands for the guild.
2. Create disabled default config row if missing.
3. Admin runs `/setup init`.

Member join:

1. Store join timestamp in cache and SQLite.
2. Keep no visible action.

Message create:

1. Ignore unsupported contexts and normal bot messages.
2. Load guild config.
3. Collect channel, member, join timing, bait target, ghost channel, and URL evidence.
4. Evaluate security outcome.
5. For high-confidence automation, contain in tar-pit and log.
6. For likely human false positive, hide channel, DM warning, and log.
7. For normal traffic, do nothing.

Interaction create:

1. Route slash commands, buttons, selects, and modal submissions.
2. Enforce admin permissions for setup/admin commands.
3. Persist setup changes.
4. Return ephemeral feedback embeds.

## Error Handling and Safety

Every event handler catches errors and logs structured context. Permission failures create admin-facing embeds when possible and never crash the process.

Channel and role operations are idempotent. Existing configured objects are reused if valid. Missing objects are recreated during setup or resync.

Command registration catches failures per guild so one guild cannot block startup. Message detection never deletes user messages in the foundation.

## Testing and Verification

Automated tests:

- URL extraction
- redirect parameter decoding
- human phrase classifier
- timing and severity evaluator
- command loader path/category detection
- schema migration smoke test

Manual verification:

- `bun run typecheck`
- `bun test`
- invite Beartrap to a test guild with required permissions
- run `/setup init`
- run `/setup status`
- trigger a ghost channel message with a test account
- verify tar-pit channel creation
- verify admin embed evidence

No Discord API integration tests are required for the foundation because they would be brittle and require external guild state.
