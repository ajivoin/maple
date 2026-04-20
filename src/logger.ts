const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(`[${stamp()}] [info]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${stamp()}] [warn]`, ...args),
  error: (...args: unknown[]) => console.error(`[${stamp()}] [error]`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) console.log(`[${stamp()}] [debug]`, ...args);
  },
};
