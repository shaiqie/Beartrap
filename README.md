<p align="center">
  <img src="./assets/beartrap.png" alt="Beartrap" width="160">
</p>

<h1 align="center">Beartrap</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/discord.js-14.x-5865f2?logo=discord&logoColor=white" alt="discord.js">
  <img src="https://img.shields.io/badge/storage-SQLite-003b57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/status-foundation_online-d6a24a" alt="Status">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License">
</p>

<p align="center">
  <a href="https://beartrap.app">Website</a> |
  <a href="https://github.com/shaiqie/Beartrap">GitHub</a>
</p>

Beartrap is a modular Discord security bot that catches suspicious automation quietly, logs useful evidence, and keeps normal members out of the blast radius. It does not arrive swinging a ban hammer. It walks in, adjusts its little security clipboard, and starts wiring traps.

Built with **Bun**, **TypeScript**, **discord.js**, and **SQLite**.

## What It Does

| System | Purpose |
| --- | --- |
| `[Ghost Network]` | Creates hidden honeypot channels with realistic names and watches for impossible interaction. |
| `[Mimic]` | Scores new members that immediately mention bait users, webhook IDs, or suspicious targets. |
| `[Tar-Pit]` | Quietly contains high-confidence automation instead of banning loudly. |
| `[Typographic Profile]` | Reduces false positives when a confused human says something like `wait, what is this?`. |
| `[Link Intel]` | Extracts URLs and passive redirect parameters without touching hostile sites. |
| `[Setup Wizard]` | Lets server admins configure Beartrap from Discord using `/setup init`. |

## Why Beartrap

Most spam bots want speed, attention, and a clean success signal. Beartrap makes that awkward.

- Fast new-account behavior gets scored.
- Hidden security surfaces become high-confidence tripwires.
- Contained users are moved into private tar-pit channels.
- Admins get clean embeds with evidence, links, and reasons.
- Humans who stumble into weird places get a polite warning instead of instant doom.

## Quick Start

Install dependencies:

```bash
bun install
```

Create an environment file:

```bash
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
DATABASE_PATH=./data/beartrap.sqlite
BEARTRAP_WEBSITE_URL=https://beartrap.app
BEARTRAP_GITHUB_URL=https://github.com/shaiqie/Beartrap
```

Run Beartrap:

```bash
bun run start
```

For development:

```bash
bun run dev
```

## Discord Setup

Enable these privileged gateway intents in the Discord Developer Portal:

- Server Members Intent
- Message Content Intent

Invite Beartrap with permissions for:

- Manage Roles
- Manage Channels
- Send Messages
- Embed Links
- View Channels
- Read Message History

After inviting Beartrap, it sends a welcome message to the best writable server channel it can find. Then run:

```text
/setup init
```

The setup flow can auto-create or manually configure:

- admin log channel
- quarantine role
- quarantine category
- ghost category and channel count
- bait users
- bait webhook IDs

Beartrap keeps guild-specific config in SQLite, so distributed installs do not need per-server environment variables.

## Commands

```text
/setup init
/setup logs
/setup quarantine
/setup ghosts
/setup bait-add-user
/setup bait-add-webhook
/setup bait-list
/setup status
/setup reset
/status
```

Admin commands require `Manage Server`.

## Project Structure

Beartrap is folder-first. Add new features by adding files, not rewriting the core.

```text
src/
  commands/
    admin/
      setup/
        index.ts
      status/
        index.ts
  events/
    guild/
      guildCreate/
        index.ts
      guildMemberAdd/
        index.ts
      messageCreate/
        index.ts
  functions/
    discord/
    time/
    urls/
  handlers/
    CommandHandler.ts
    EventHandler.ts
  services/
    config/
    ghost/
    intel/
    security/
    tarpit/
    telemetry/
    welcome/
  storage/
  types/
```

Command categories are detected from folders. For example:

```text
src/commands/moderation/ban/index.ts
```

is automatically loaded as category `moderation`.

## Security Notes

Beartrap only uses Discord events that bots can actually observe. Discord does not expose channel-view events, raw client scraping telemetry, or user DMs to bots. The Ghost Network therefore triggers on observable interactions, while the scrape telemetry service is intentionally adapter-based for future external signals.

Link intelligence is passive by default. Beartrap extracts URLs and decodes redirect parameters, but it does not fetch suspicious links.

## Testing

Run type checks:

```bash
bun run typecheck
```

Run tests:

```bash
bun test
```

Current coverage focuses on:

- URL extraction
- redirect decoding
- security scoring
- command category loading
- SQLite schema migration

## Development

Beartrap uses:

- Bun runtime
- strict TypeScript
- dynamic command and event loaders
- SQLite through `bun:sqlite`
- service-based architecture through `AppContext`

Keep modules small. Commands, events, and shared functions should live in their own folders. Beartrap likes tidy shelves. It is not judging you, but it has noticed.

## Responsible Use

Beartrap is a defensive moderation and security tool. Test in a private guild, use `.test` domains for fake payloads, and do not run phishing or spam experiments against real communities.

## License

Beartrap is released under the [MIT License](./LICENSE).
