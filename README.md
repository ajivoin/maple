# maple

A Discord audio bot built with [discord.js](https://discord.js.org) v14 and [yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Features

Slash commands, per-guild queue, in-memory state:

| Command | Description |
|---|---|
| `/play query:<url or search>` | Join your voice channel and play or enqueue a track. Accepts URLs (YouTube, SoundCloud, etc.) or free-text search (defaults to YouTube). |
| `/pause` | Pause or resume the current track. |
| `/stop` | Clear the queue and disconnect. |
| `/skip` | Skip to the next track. |
| `/rewind` | Restart the current track from the beginning. |
| `/save` | DM yourself the link to the currently playing track. |

## Requirements

- Node.js latest LTS (see `.nvmrc`)
- `ffmpeg` and `yt-dlp` on `PATH`
- A Discord application / bot token

The Docker image installs `ffmpeg` and `yt-dlp` for you.

## Setup

1. Copy environment template and fill it in:
   ```sh
   cp .env.example .env
   ```
   - `DISCORD_TOKEN` — bot token from the [Developer Portal](https://discord.com/developers/applications).
   - `CLIENT_ID` — application (client) ID.
   - `DEV_GUILD_ID` — only needed in development; the guild in which slash commands are registered instantly.
   - `NODE_ENV` — `development` or `production`.

2. Invite the bot to your server with `bot` + `applications.commands` scopes and the **Connect** and **Speak** voice permissions.

## Local development

```sh
npm install
npm run deploy   # registers slash commands in DEV_GUILD_ID
npm run dev      # hot-reload via tsx watch
```

## Production build

```sh
npm install
npm run build
NODE_ENV=production npm run deploy   # registers global commands
NODE_ENV=production npm start
```

## Docker

```sh
docker compose build
docker compose up -d
```

Run the slash-command deployment once per command change. It can be executed inside the container:

```sh
docker compose run --rm maple node -e "process.env.NODE_ENV='production'" \
  && docker compose exec maple npx tsx scripts/deploy-commands.ts
```

Or run it from the host with `npm run deploy` against the same `.env`.

## Project layout

```
src/
  index.ts                  Entry point
  config.ts                 Env loading and validation (zod)
  logger.ts
  commands/                 Slash command handlers
  audio/
    PlayerManager.ts        Map of guildId -> GuildPlayer
    GuildPlayer.ts          Queue + voice connection per guild
    ytdlp.ts                yt-dlp wrapper (metadata + audio stream)
  events/
    interactionCreate.ts
    ready.ts
scripts/
  deploy-commands.ts        Registers slash commands
```
