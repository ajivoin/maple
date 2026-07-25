# maple

A general-purpose Discord bot built with [discord.js](https://discord.js.org) v14. Features audio playback via [yt-dlp](https://github.com/yt-dlp/yt-dlp), RSS feed subscriptions, and Letterboxd diary subscriptions.

## Features

### Audio

Per-guild voice queue with in-memory state:

| Command | Description |
|---|---|
| `/play url:<url>` | Join your voice channel and play a track from a direct URL. |
| `/search query:<text>` | Search YouTube and play the top result. |
| `/pause` | Pause or resume the current track. |
| `/stop` | Clear the queue and disconnect. |
| `/skip` | Skip to the next track. |
| `/rewind` | Restart the current track from the beginning. |
| `/queue` | Show the current queue. |
| `/nowplaying` | Show the currently playing track. |
| `/loop mode:<off\|track\|queue>` | Set the loop mode. |
| `/shuffle` | Randomly shuffle the upcoming tracks. |
| `/remove position:<n>` | Remove a track from the queue by position. |
| `/save` | DM yourself a link to the currently playing track. |

### RSS feeds

Subscribe channels to any RSS/Atom feed. New items are posted as embeds automatically.

| Command | Description |
|---|---|
| `/rss_add url:<url>` | Subscribe this channel to an RSS feed. Pass `post_latest:false` to skip posting the most recent item on subscribe. |
| `/rss_list` | List all RSS feeds subscribed in this channel. |
| `/rss_remove url:<url>` | Unsubscribe this channel from an RSS feed. |
| `/rss_pause url:<url>` | Pause a feed subscription without removing it. |
| `/rss_resume url:<url>` | Resume a paused feed subscription. |

Feeds that fail 3 consecutive polls are paused automatically and a warning is posted to the channel.

### Letterboxd

Subscribe channels to a Letterboxd member's film diary. New diary entries are posted as embeds with the movie poster thumbnail.

| Command | Description |
|---|---|
| `/letterboxd_add username:<user>` | Subscribe this channel to a Letterboxd diary. Posts the most recent entry immediately. |
| `/letterboxd_list` | List all Letterboxd diaries subscribed in this channel. |
| `/letterboxd_remove username:<user>` | Unsubscribe this channel from a Letterboxd diary. |

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
   - `RSS_POLL_INTERVAL_MS` — how often to poll RSS/Letterboxd feeds (default: `600000` = 10 min).
   - `DATABASE_PATH` — path to the SQLite database file (default: `./data/maple.db`).

2. Invite the bot to your server with `bot` + `applications.commands` scopes and the **Connect**, **Speak**, and **Send Messages** permissions.

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
  modules/
    audio/                  Voice queue, yt-dlp integration
    rss/                    RSS/Atom feed polling and subscriptions
    letterboxd/             Letterboxd diary subscriptions
    general/                /help and other utility commands
  core/                     Command registry, interaction router, loader
  db/                       SQLite schema and singleton (better-sqlite3)
scripts/
  deploy-commands.ts        Registers slash commands
```
