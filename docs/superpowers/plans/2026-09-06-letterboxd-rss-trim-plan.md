# Plan: Trim generic RSS surface, enrich Letterboxd embeds, add force-refresh

## Context

Maple is a discord.js v14 bot. The `rss` module (`src/modules/rss/`) provides
generic RSS slash commands (`rss_add`, `rss_list`, `rss_remove`, `rss_pause`,
`rss_resume`) plus a backend: `db.ts` (better-sqlite3 CRUD over
`rss_subscriptions`) and `service.ts` (`RssPoller` — polls feeds on an
interval, posts new items as embeds, auto-pauses failing feeds, hourly-retries
auto-paused Letterboxd feeds).

The `letterboxd` module (`src/modules/letterboxd/`) is a thin front-end that
reuses that backend: its commands (`letterboxd_add`, `letterboxd_list`,
`letterboxd_remove`) call `src/modules/rss/db.ts` and `buildItemEmbed` from
`src/modules/rss/service.ts`, and `feeds.ts` holds Letterboxd-specific parsing
(`extractReviewText`, `extractPosterUrl`, `isLetterboxdFeed`, `buildFeedUrl`,
`usernameFromFeedUrl`).

Both modules are wired in `src/index.ts` (`loadModules([...])` + intents +
`onReady`) and `scripts/deploy-commands.ts` (`loadModules([...])` to populate
the registry for `npm run deploy`). `RssModule.onReady` currently constructs
and starts the `RssPoller`.

Goal of this branch:
1. Remove the generic RSS commands from Discord exposure; keep the RSS backend
   (`db.ts`, `service.ts`) alive purely as Letterboxd plumbing, poller started
   by the Letterboxd module.
2. When a review embed shows the user's review text, use the review's
   "watched on" date as the embed timestamp (falling back to the feed item's
   publish date when absent).
3. Add `/letterboxd_refresh`, gated to feed-admin users, that forces an
   immediate poll of the Letterboxd feeds.

## Global Constraints

- TypeScript strict, ESM, Node ≥ 24. **All relative imports use `.js`
  extensions.**
- Follow existing command style: `if (!interaction.inGuild()) return;` guard at
  the top of `execute`; network/async commands use `deferReply` +
  `editReply`; errors/confirmations only the invoker should see use
  `MessageFlags.Ephemeral`.
- Do **not** run `npm run deploy` — it calls the live Discord API. The human
  runs it after merge.
- Do **not** remove or rewrite the generic (non-Letterboxd) branches inside
  `RssPoller.pollOne` / `filterNewItems` / retry logic — the poller stays a
  general RSS poller internally; only the *command surface* is removed.
- Each task ends green on: `npm run build`, `npx vitest run`, `npm run lint`,
  `npm run format` (Prettier writes; commit the result).
- No AI attribution / `Co-Authored-By` trailers; no claude.ai links in commits.
- The "watched on" line in a Letterboxd item's `contentSnippet` has the exact
  shape `Watched on <Weekday> <Month> <Day>, <Year>.` — e.g.
  `Watched on Friday July 24, 2026.` (this is the same line
  `extractReviewText` already strips with `/Watched on \w+ \w+ \d+, \d+\./g`).

## Task 1: Remove generic RSS command surface; poller becomes Letterboxd plumbing

### Files

- **Delete** `src/modules/rss/commands/rss_add.ts`, `rss_list.ts`,
  `rss_remove.ts`, `rss_pause.ts`, `rss_resume.ts` (the whole
  `src/modules/rss/commands/` directory).
- **Delete** `src/modules/rss/index.ts` (the `RssModule` definition).
- **`src/modules/rss/db.ts`**: delete the now-unused `pauseSubscription` and
  `resumeSubscription` exports. Keep everything else (all still used by the
  Letterboxd commands and the poller).
- **`src/modules/rss/service.ts`**: add a module-level singleton for the
  poller so other modules can start it and reach it later:

  ```ts
  let activePoller: RssPoller | null = null;

  /** Starts the shared RSS poller once; subsequent calls return the running instance. */
  export function startRssPoller(client: Client): RssPoller {
    if (!activePoller) {
      activePoller = new RssPoller(client);
      activePoller.start();
    }
    return activePoller;
  }

  export function getRssPoller(): RssPoller | null {
    return activePoller;
  }
  ```

  (`Client` type is already imported from `discord.js` in this file.)
- **`src/modules/letterboxd/index.ts`**: add an `onReady` that starts the
  poller:

  ```ts
  import type { Client } from 'discord.js';
  import { startRssPoller } from '../rss/service.js';
  // ...
  export const LetterboxdModule: Module = {
    name: 'letterboxd',
    commands: [letterboxdAdd, letterboxdList, letterboxdRemove],
    onReady: (client: Client) => {
      startRssPoller(client);
    },
  };
  ```

- **`src/index.ts`**: remove `import { RssModule } from './modules/rss/index.js';`
  and remove `RssModule` from the `loadModules([...])` array.
- **`scripts/deploy-commands.ts`**: remove the `RssModule` import and remove it
  from the `loadModules([...])` call.
- **`CLAUDE.md`**: update to match reality:
  - In "Project Layout", replace the `modules/rss/` command listing —
    `rss/commands/` no longer exists; note `rss/` is now internal Letterboxd
    plumbing (`db.ts`, `service.ts`). Add the `modules/letterboxd/` subtree
    (`index.ts`, `feeds.ts`, `commands/letterboxd_add|list|remove.ts`), which
    is currently undocumented.
  - Rewrite the "RSS Layer" section: the poller is started in
    `LetterboxdModule.onReady` (not `RssModule.onReady`); there are no generic
    RSS slash commands; drop the `/rss_remove`, `/rss_pause`, `/rss_resume`
    autocomplete bullet and the "RSS commands gate write operations" bullet.
    Keep the auto-pause / hourly Letterboxd retry description (still accurate),
    fixing the stray `/rss_pause` reference (manual re-enable is now via
    `letterboxd_remove` + `letterboxd_add`, or `/letterboxd_refresh` once
    Task 3 lands — Task 1 may simply say "manual pause clears the flag").
  - Add a short "Letterboxd Layer" note describing the module and that it
    reuses the RSS backend.

### Verification

- `npm run build` — no TS errors (confirms nothing still imports the deleted
  files / functions).
- `grep -rn "RssModule\|rss/commands\|pauseSubscription\|resumeSubscription" src scripts` —
  no hits.
- `npx vitest run` — all existing tests still pass (42 at baseline).
- `npm run lint && npm run format`.

### Notes for implementer

- No new tests required for this task — it is deletion + rewiring, covered by
  the type-checker and the existing `rssRetry.test.ts` (which constructs
  `RssPoller` directly and is unaffected).
- `requireManageChannels` in `src/permissions.ts` becomes unused after this
  task but is re-used in Task 3 — **leave it in place**.

## Task 2: Watched date drives the review-embed timestamp

### Files

- **`src/modules/letterboxd/feeds.ts`**: add

  ```ts
  /**
   * Pulls the diary "Watched on <Weekday> <Month> <Day>, <Year>." date out of a
   * Letterboxd item. Returns null when the line is absent or unparseable.
   */
  export function extractWatchedDate(item: Parser.Item): Date | null {
    const snippet = item.contentSnippet ?? item.summary ?? '';
    const match = snippet.match(/Watched on \w+ (\w+ \d+, \d+)\./);
    if (!match) return null;
    const date = new Date(match[1]);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  ```

- **`src/modules/rss/service.ts`** — `buildItemEmbed`: add an optional 5th
  parameter `watchedDate?: Date | null`. Change the `.setTimestamp(...)` call
  to:

  ```ts
  .setTimestamp(watchedDate ?? (item.isoDate ? new Date(item.isoDate) : null))
  ```

  Do not change any other behavior (description/spoiler/thumbnail logic
  untouched). Existing callers that omit the argument keep the current
  `isoDate` behavior.

- **`src/modules/rss/service.ts`** — `RssPoller.pollOne`: in the
  `isLetterboxd` branch, compute the watched date from the **original** `item`
  (before the `contentSnippet` is replaced with the cleaned review text) and
  pass it as the 5th arg to `buildItemEmbed`. `extractWatchedDate` is imported
  from `../letterboxd/feeds.js` (this file already imports `extractReviewText`,
  `extractPosterUrl`, `isLetterboxdFeed` from there).

  ```ts
  const isLetterboxd = sub.feed_url.includes('letterboxd.com');
  for (const item of newItems.slice().reverse()) {
    const thumbnailUrl = isLetterboxd ? extractPosterUrl(item) : null;
    const watchedDate = isLetterboxd ? extractWatchedDate(item) : null;
    const cleaned = isLetterboxd
      ? { ...item, contentSnippet: extractReviewText(item) ?? undefined }
      : item;
    await channel.send({
      embeds: [buildItemEmbed(feedTitle, cleaned, true, thumbnailUrl, watchedDate)],
    });
  }
  ```

- **`src/modules/letterboxd/commands/letterboxd_add.ts`**: import
  `extractWatchedDate` from `../feeds.js` and pass
  `extractWatchedDate(latestItem)` as the 5th arg to the `buildItemEmbed`
  call there (compute from `latestItem`, not the `cleaned` object).

### Tests — `src/__tests__/letterboxd.test.ts`

Add a `describe('extractWatchedDate')` block (import it alongside the existing
`feeds.js` imports):

- returns a `Date` for `'A great film.\n\nWatched on Friday July 24, 2026.'`
  whose `getUTCFullYear()`/month/date match 2026-07-24 (assert via
  `toISOString().startsWith('2026-07-24')` — `new Date('July 24, 2026')`
  parses as local midnight; if that makes the ISO date flaky in CI, assert on
  `.getFullYear() === 2026 && .getMonth() === 6 && .getDate() === 24` instead).
- returns `null` for `'Just a plain review.'` (no watched line).
- returns `null` for `{}` (no snippet).

Extend the existing `describe('buildItemEmbed')` block:

- when a `watchedDate` is passed, `embed.toJSON().timestamp` equals
  `watchedDate.toISOString()`.
- when `watchedDate` is omitted/`null`, `embed.toJSON().timestamp` falls back
  to the `item.isoDate` value (`'2026-06-01T00:00:00.000Z'` for the block's
  fixture `item`).

### Verification

- `npx vitest run` — new tests pass, all prior tests still pass.
- `npm run build && npm run lint && npm run format`.

## Task 3: `/letterboxd_refresh` — admin force-refresh

Depends on Task 1 (`getRssPoller`).

### Files

- **`src/modules/rss/service.ts`** — add a public method to `RssPoller`:

  ```ts
  /** Immediately polls every active Letterboxd subscription. Returns how many were polled. */
  async refreshLetterboxd(): Promise<number> {
    const subs = rssDb
      .getActiveSubscriptions()
      .filter((sub) => isLetterboxdFeed(sub.feed_url));
    if (subs.length === 0) return 0;
    logger.info(`[rss] Forced refresh of ${subs.length} Letterboxd subscription(s).`);
    await Promise.allSettled(subs.map((sub) => this.pollOne(sub)));
    return subs.length;
  }
  ```

  (`rssDb`, `isLetterboxdFeed`, `logger` are already imported in this file.)

- **`src/modules/letterboxd/commands/letterboxd_refresh.ts`** — new command:

  ```ts
  import {
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
  } from 'discord.js';
  import { getRssPoller } from '../../rss/service.js';
  import { requireManageChannels } from '../../../permissions.js';
  import type { SlashCommand } from '../../../types.js';

  const command: SlashCommand = {
    data: new SlashCommandBuilder()
      .setName('letterboxd_refresh')
      .setDescription('Force an immediate poll of this server’s Letterboxd feeds.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild()) return;
      if (!(await requireManageChannels(interaction))) return;

      const poller = getRssPoller();
      if (!poller) {
        await interaction.reply({
          content: 'The feed poller is not running yet. Try again in a moment.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const count = await poller.refreshLetterboxd();
      await interaction.editReply(
        count === 0
          ? 'No active Letterboxd feeds to refresh.'
          : `Refreshed ${count} Letterboxd feed${count === 1 ? '' : 's'}. New entries will post shortly.`,
      );
    },
  };

  export default command;
  ```

  Note: `requireManageChannels` calls `interaction.reply(...)` on failure, so
  the guard must run **before** `deferReply`.

- **`src/modules/letterboxd/index.ts`**: import `letterboxdRefresh` and add it
  to the `commands` array.

- **`CLAUDE.md`**: mention `/letterboxd_refresh` in the Letterboxd section and
  note it (and the other feed-admin actions) are gated behind
  `PermissionFlagsBits.ManageChannels`.

### Tests — `src/__tests__/letterboxd.test.ts` (or a new `letterboxdRefresh.test.ts` if cleaner)

Follow the mocking style of `rssRetry.test.ts` (mock `../modules/rss/db.js`,
mock `rss-parser`, `vi.mock('../config.js', ...)`).

- `refreshLetterboxd` returns `0` and does not call the parser when
  `getActiveSubscriptions` returns `[]`.
- `refreshLetterboxd` polls only Letterboxd subs: given active subs
  `[letterboxd.com/a/rss/, example.com/feed]`, returns `1` and `parseURL` is
  called once with the Letterboxd URL.

### Verification

- `npx vitest run` — new + existing tests pass.
- `npm run build && npm run lint && npm run format`.
- `grep -rn "letterboxd_refresh" src` shows it registered in the module.

## Final state

- Discord shows: `letterboxd_add`, `letterboxd_list`, `letterboxd_remove`,
  `letterboxd_refresh` — no `rss_*` commands. (Human runs `npm run deploy`.)
- `RssPoller` runs, started by `LetterboxdModule.onReady`.
- Review embeds are timestamped with the date the film was watched.
- Feed-admins can force an immediate Letterboxd poll.
