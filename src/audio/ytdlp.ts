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

export async function resolveTrack(
  query: string,
): Promise<{ url: string; title: string; duration?: number }> {
  const args = [
    '-J',
    '--no-warnings',
    '--no-playlist',
    '--default-search',
    'ytsearch1',
    '--',
    query,
  ];

  const { stdout, stderr, code } = await runYtDlp(args);
  if (code !== 0) {
    throw new YtDlpError(
      `yt-dlp exited with code ${code} while resolving query: ${stderr.trim() || 'no stderr'}`,
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
    throw new YtDlpError('yt-dlp did not return a usable track (missing url or title).');
  }
  return { url, title, duration: entry.duration };
}

export function createAudioStream(url: string): Readable {
  const child = spawn(
    'yt-dlp',
    ['-f', 'bestaudio', '-o', '-', '--no-playlist', '--no-warnings', '--', url],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => logger.debug('yt-dlp stderr:', data));
  child.on('error', (err) => logger.error('yt-dlp spawn error:', err));

  child.stdout.on('close', () => {
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
