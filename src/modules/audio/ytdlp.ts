import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

export class YtDlpError extends Error {}

type YtDlpJson = {
  webpage_url?: string;
  original_url?: string;
  url?: string;
  title?: string;
  duration?: number;
  entries?: YtDlpJson[];
  _type?: string;
};

const RESOLVE_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT_RESOLVE = 4;

let inflight = 0;
const waitQueue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (inflight < MAX_CONCURRENT_RESOLVE) {
    inflight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function release(): void {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    inflight--;
  }
}

export async function resolveUrl(
  url: string,
): Promise<{ url: string; title: string; duration?: number }> {
  logger.info(`Resolving URL: "${url}"`);
  return _resolve(url, ['-J', '--no-warnings', '--no-playlist', '--', url]);
}

export async function resolveSearch(
  query: string,
): Promise<{ url: string; title: string; duration?: number }> {
  logger.info(`Searching YouTube for: "${query}"`);
  return _resolve(query, ['-J', '--no-warnings', '--no-playlist', '--', `ytsearch1:${query}`]);
}

async function _resolve(
  input: string,
  args: string[],
): Promise<{ url: string; title: string; duration?: number }> {
  await acquire();
  const { promise, child } = runYtDlp(args);
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    let result: { stdout: string; stderr: string; code: number | null };
    try {
      result = await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
            reject(new YtDlpError(`yt-dlp timed out after ${RESOLVE_TIMEOUT_MS / 1000}s`));
          }, RESOLVE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    const { stdout, stderr, code } = result;
    if (code !== 0) {
      logger.warn(
        `yt-dlp resolve failed (code ${code}) for "${input}": ${stderr.trim() || 'no stderr'}`,
      );
      throw new YtDlpError(`yt-dlp exited with code ${code}: ${stderr.trim() || 'no stderr'}`);
    }

    let parsed: YtDlpJson;
    try {
      parsed = JSON.parse(stdout) as YtDlpJson;
    } catch (err) {
      throw new YtDlpError(`Failed to parse yt-dlp JSON output: ${(err as Error).message}`);
    }

    const entry =
      parsed._type === 'playlist' && parsed.entries?.length ? parsed.entries[0] : parsed;
    const url = entry?.webpage_url ?? entry?.original_url ?? entry?.url;
    const title = entry?.title;
    if (!url || !title) {
      logger.warn(`yt-dlp returned unusable JSON for "${input}":`, {
        url,
        title,
        _type: parsed._type,
      });
      throw new YtDlpError('yt-dlp did not return a usable track (missing url or title).');
    }
    logger.info(
      `Resolved "${input}" → "${title}" (${url})${entry?.duration ? ` [${entry.duration}s]` : ''}`,
    );
    return { url, title, duration: entry?.duration };
  } finally {
    release();
  }
}

export type AudioStream = {
  stream: Readable;
  kill: () => void;
};

export function createAudioStream(url: string): AudioStream {
  logger.debug(`Spawning yt-dlp audio stream for: ${url}`);
  const child = spawn(
    config.YTDLP_PATH,
    ['-f', 'bestaudio', '-o', '-', '--no-playlist', '--no-warnings', '--', url],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  if (!child.stdout) {
    throw new YtDlpError('yt-dlp spawn failed: stdout is unavailable');
  }

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data: string) => {
    const trimmed = data.trim();
    if (trimmed) logger.debug(`yt-dlp stream stderr: ${trimmed}`);
  });
  child.on('error', (err) => logger.error('yt-dlp spawn error:', err));
  child.on('close', (code) => {
    if (code !== 0 && code !== null)
      logger.warn(`yt-dlp stream process exited with code ${code} for ${url}`);
    else logger.debug(`yt-dlp stream process closed (code ${code}) for ${url}`);
  });

  child.stdout.on('error', (err) => logger.error(`yt-dlp stdout error for ${url}:`, err));

  let firstChunk = true;
  child.stdout.on('data', () => {
    if (firstChunk) {
      firstChunk = false;
      logger.debug(`yt-dlp stream produced first chunk for ${url}`);
    }
  });

  child.stdout.on('close', () => {
    if (firstChunk) logger.warn(`yt-dlp stream closed without producing any data for ${url}`);
    if (!child.killed) child.kill('SIGKILL');
  });

  const kill = () => {
    if (!child.killed) child.kill('SIGKILL');
  };

  return { stream: child.stdout, kill };
}

function runYtDlp(args: string[]): {
  promise: Promise<{ stdout: string; stderr: string; code: number | null }>;
  child: ChildProcess;
} {
  const child = spawn(config.YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  const promise = new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve, reject) => {
      child.stdout!.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          code,
        });
      });
    },
  );

  return { promise, child };
}
