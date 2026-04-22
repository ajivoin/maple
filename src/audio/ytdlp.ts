import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { logger } from '../logger.js';

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
  const { stdout, stderr, code } = await runYtDlp(args);
  if (code !== 0) {
    logger.warn(`yt-dlp resolve failed (code ${code}) for "${input}": ${stderr.trim() || 'no stderr'}`);
    throw new YtDlpError(
      `yt-dlp exited with code ${code}: ${stderr.trim() || 'no stderr'}`,
    );
  }

  let parsed: YtDlpJson;
  try {
    parsed = JSON.parse(stdout) as YtDlpJson;
  } catch (err) {
    throw new YtDlpError(`Failed to parse yt-dlp JSON output: ${(err as Error).message}`);
  }

  const entry = parsed._type === 'playlist' && parsed.entries?.length ? parsed.entries[0] : parsed;
  const url = entry.webpage_url ?? entry.original_url ?? entry.url;
  const title = entry.title;
  if (!url || !title) {
    logger.warn(`yt-dlp returned unusable JSON for "${input}":`, { url, title, _type: parsed._type });
    throw new YtDlpError('yt-dlp did not return a usable track (missing url or title).');
  }
  logger.info(`Resolved "${input}" → "${title}" (${url})${entry.duration ? ` [${entry.duration}s]` : ''}`);
  return { url, title, duration: entry.duration };
}

export function createAudioStream(url: string): Readable {
  logger.debug(`Spawning yt-dlp audio stream for: ${url}`);
  const child = spawn(
    'yt-dlp',
    ['-f', 'bestaudio', '-o', '-', '--no-playlist', '--no-warnings', '--', url],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data: string) => {
    const trimmed = data.trim();
    if (trimmed) logger.debug(`yt-dlp stream stderr: ${trimmed}`);
  });
  child.on('error', (err) => logger.error('yt-dlp spawn error:', err));
  child.on('close', (code) => {
    if (code !== 0 && code !== null) logger.warn(`yt-dlp stream process exited with code ${code} for ${url}`);
    else logger.debug(`yt-dlp stream process closed (code ${code}) for ${url}`);
  });

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

  return child.stdout;
}

function runYtDlp(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        code,
      });
    });
  });
}
