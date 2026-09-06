# Maple — Claude Context

General-purpose Discord bot built with discord.js v14 + @discordjs/voice, streaming audio via yt-dlp, with RSS feed subscriptions.

## Stack

- **Language**: TypeScript (strict, ESM, Node ≥ 24)
- **Bot framework**: discord.js v14
- **Audio**: @discordjs/voice + yt-dlp subprocess
- **RSS**: rss-parser + better-sqlite3
- **Config validation**: Zod
- **Dev runner**: `tsx watch`

## Project Layout

```
src/
  index.ts              # Bootstrap: initDb → loadModules → Client → login
  config.ts             # Zod-validated env
  logger.ts             # Singleton logger with ISO timestamps; debug gated on DEBUG env var
  types.ts              # SlashCommand, Track, LoopMode, Module, EventRegistrar types
  permissions.ts        # hasMuteMembers(), requireMuteMembers()
  util.ts               # formatDuration()
  core/
    loader.ts           # loadModules(): aggregates commands/events/intents from all modules
    registry.ts         # registerCommand(), getCommandMap(), getAllCommands()
    interactionCreate.ts # Generic interaction router; handles autocomplete
    ready.ts            # registerReady(client, onReady)
  db/
    schema.ts           # SQL DDL + initializeSchema()
    index.ts            # initDb() / getDb() singleton
  modules/
    audio/
      index.ts          # AudioModule definition
      commands/         # play, search, pause, stop, skip, rewind, save, queue, nowplaying, loop, shuffle, remove
      GuildPlayer.ts    # Per-guild voice connection, queue, auto-disconnect after 60s idle
      PlayerManager.ts  # Singleton map of guildId → GuildPlayer
      ytdlp.ts          # resolveUrl(), resolveSearch(), createAudioStream()
      events/
        voiceStateUpdate.ts
    rss/
      index.ts          # RssModule definition; starts RssPoller in onReady
      commands/         # rss_add, rss_list, rss_remove, rss_pause, rss_resume
      db.ts             # RSS CRUD operations (better-sqlite3, synchronous)
      service.ts        # RssPoller: polls feeds, posts new items as embeds
    general/
      index.ts          # GeneralModule definition
      commands/
        help.ts         # Auto-built from getAllCommands() — no manual sync needed
scripts/
  deploy-commands.ts    # Registers commands via Discord REST API
```

## Adding a New Module

1. Create `src/modules/<name>/index.ts` exporting a `Module` object.
2. Import it in `src/index.ts` and add it to the `loadModules([...])` array.
3. Add it to `scripts/deploy-commands.ts` in the `loadModules([...])` call.
4. Run `npm run deploy` to register the updated command list with Discord.

The `/help` command auto-discovers all registered commands — no manual updates needed.

### Module interface

```typescript
interface Module {
  name: string;
  commands: SlashCommand[];
  intents?: GatewayIntentBits[];
  events?: EventRegistrar[];
  onReady?: (client: Client) => void | Promise<void>;
}
```

### Command template

```typescript
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('name')
    .setDescription('Description shown in Discord and in /help.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    // ...
    await interaction.reply('Response');
  },

  // Optional: for commands with setAutocomplete(true) options
  async autocomplete(interaction) {
    await interaction.respond([{ name: 'Label', value: 'value' }]);
  },
};

export default command;
```

## Audio Layer

**`ytdlp.ts`** (in `src/modules/audio/`):

| Export | Purpose |
|--------|---------|
| `resolveUrl(url)` | Resolves a direct URL via yt-dlp (no search fallback) |
| `resolveSearch(query)` | Searches YouTube with `ytsearch1:` prefix |
| `createAudioStream(url)` | Spawns yt-dlp to pipe audio for playback |
| `YtDlpError` | Thrown on yt-dlp failure; catch to surface user-friendly messages |

**`GuildPlayer`** is retrieved via `playerManager.getOrCreate(voiceChannel)`. Key methods: `enqueue()`, `skip()`, `pauseToggle()`, `rewind()`, `stop()`, `currentTrack()`.

## RSS Layer

- `src/modules/rss/db.ts` — CRUD for `rss_subscriptions` table (better-sqlite3, synchronous)
- `src/modules/rss/service.ts` — `RssPoller` class; started in `RssModule.onReady`; polls every `RSS_POLL_INTERVAL_MS` ms; posts new items as Discord embeds; auto-pauses feeds that fail 3 times
- Auto-paused feeds are flagged with `auto_paused = 1`; every `RSS_RETRY_INTERVAL_MS` ms the poller re-checks the auto-paused **Letterboxd** feeds and resumes any that parse again (manual `/rss_pause` clears the flag, so it is never auto-resumed)
- RSS commands gate write operations behind `PermissionFlagsBits.ManageChannels`
- `/rss_remove`, `/rss_pause`, `/rss_resume` use Discord autocomplete on the `url` option

## Response Conventions

- **Ephemeral** (`MessageFlags.Ephemeral`): errors, confirmations only the invoking user should see
- **Deferred reply** (`interaction.deferReply()` → `interaction.editReply()`): any command that calls yt-dlp or async network ops (takes >3 s)
- **Standard reply**: short, synchronous responses visible to the channel
- Guild-only guard: `if (!interaction.inGuild()) return;` at the top of every command

## Scripts

```bash
npm run dev      # Hot-reload dev (tsx watch)
npm run build    # tsc compile to dist/
npm run start    # Run compiled bot
npm run deploy   # Register slash commands with Discord
npm run lint     # ESLint
npm run format   # Prettier
```

`npm run deploy` behavior:
- `NODE_ENV=production` → global registration (up to 1 hour propagation)
- otherwise → guild-only registration to `DEV_GUILD_ID` (instant)

## Contributor Guidelines

- **No claude.ai links**: Do not include links to claude.ai in commit messages or pull request descriptions — this is a security/privacy requirement.
- **Commit authorship**: Commits must be authored as the human contributor. Do not add `Co-Authored-By: Claude` trailers or any AI attribution to commits or PRs in this repo.
- **Lint and format before every push**: Run `npm run lint && npm run format` and fix any issues before committing or pushing. The CI pipeline enforces both.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot token |
| `CLIENT_ID` | Yes | Application ID |
| `DEV_GUILD_ID` | Dev only | Guild for instant command registration |
| `NODE_ENV` | No | `development` (default) / `production` / `test` |
| `DEBUG` | No | Set to any value to enable debug logs |
| `YOUTUBE_COOKIES_FILE` | No | Absolute path to a Netscape-format cookies file; passed as `--cookies` to yt-dlp for age-restricted videos |
| `DATABASE_PATH` | No | Path to SQLite DB file (default: `./data/maple.db`) |
| `RSS_POLL_INTERVAL_MS` | No | How often to poll RSS feeds in ms (default: `600000` = 10 min) |
| `RSS_RETRY_INTERVAL_MS` | No | How often to retry auto-paused Letterboxd feeds in ms (default: `3600000` = 1 hour) |
