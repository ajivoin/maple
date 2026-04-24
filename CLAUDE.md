# Maple — Claude Context

Discord audio bot built with discord.js v14 + @discordjs/voice, streaming audio via yt-dlp.

## Stack

- **Language**: TypeScript (strict, ESM, Node ≥ 24)
- **Bot framework**: discord.js v14
- **Audio**: @discordjs/voice + yt-dlp subprocess
- **Config validation**: Zod
- **Dev runner**: `tsx watch`

## Project Layout

```
src/
  index.ts              # Client setup, registers event handlers
  config.ts             # Zod-validated env (DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID)
  logger.ts             # Singleton logger with ISO timestamps; debug gated on DEBUG env var
  types.ts              # SlashCommand type, Track type
  commands/
    index.ts            # Master list: `commands[]` and `commandMap`
    help.ts             # /help embed — must stay in sync with command list (see below)
    play.ts             # /play  — direct URL only
    search.ts           # /search — YouTube natural-language search
    pause.ts            # /pause
    stop.ts             # /stop
    skip.ts             # /skip
    rewind.ts           # /rewind
    save.ts             # /save
  events/
    interactionCreate.ts  # Routes ChatInputCommands via commandMap
    ready.ts
  audio/
    PlayerManager.ts    # Singleton map of guildId → GuildPlayer
    GuildPlayer.ts      # Per-guild voice connection, queue, auto-disconnect after 60s idle
    ytdlp.ts            # resolveUrl(), resolveSearch(), createAudioStream()
scripts/
  deploy-commands.ts    # Registers commands via Discord REST API
```

## Adding a New Command

1. Create `src/commands/<name>.ts` — export a `SlashCommand` default.
2. Import it in `src/commands/index.ts` and add it to the `commands` array.
3. **Update `src/commands/help.ts`**: import the new command and add it to the `LISTED` array so it appears in the `/help` embed.
4. Run `npm run deploy` to register the updated command list with Discord.

### Command template

```typescript
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('name')
    .setDescription('Description shown in Discord and in /help.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    // ...
    await interaction.reply('Response');
  },
};

export default command;
```

## Audio Layer

**`ytdlp.ts`** exports three things:

| Export | Purpose |
|--------|---------|
| `resolveUrl(url)` | Resolves a direct URL via yt-dlp (no search fallback) |
| `resolveSearch(query)` | Searches YouTube with `ytsearch1:` prefix |
| `createAudioStream(url)` | Spawns yt-dlp to pipe audio for playback |
| `YtDlpError` | Thrown on yt-dlp failure; catch to surface user-friendly messages |

**`GuildPlayer`** is retrieved via `playerManager.getOrCreate(voiceChannel)`. Key methods: `enqueue()`, `skip()`, `pauseToggle()`, `rewind()`, `stop()`, `currentTrack()`.

## Response Conventions

- **Ephemeral** (`MessageFlags.Ephemeral`): errors, confirmations only the invoking user should see
- **Deferred reply** (`interaction.deferReply()` → `interaction.editReply()`): any command that calls yt-dlp or async audio setup (takes >3 s)
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

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot token |
| `CLIENT_ID` | Yes | Application ID |
| `DEV_GUILD_ID` | Dev only | Guild for instant command registration |
| `NODE_ENV` | No | `development` (default) / `production` / `test` |
| `DEBUG` | No | Set to any value to enable debug logs |
| `YOUTUBE_COOKIES_FILE` | No | Absolute path to a Netscape-format cookies file; passed as `--cookies` to yt-dlp for age-restricted videos |
