/**
 * Minimal timestamped, level-filtered logger. Console-based on purpose — swap
 * for pino/winston later without touching callers (same call signatures).
 *
 * Level threshold comes from `LOG_LEVEL` (debug|info|warn|error); if unset it
 * defaults to `debug` in development and `info` everywhere else. Each method
 * takes a message plus any number of trailing args (e.g. a meta object).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

function resolveThreshold(): Level {
  const configured = (process.env.LOG_LEVEL ?? '').toLowerCase();
  if ((LEVELS as readonly string[]).includes(configured)) return configured as Level;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const threshold = resolveThreshold();
const ts = () => new Date().toISOString();
const enabled = (level: Level) => RANK[level] >= RANK[threshold];

function emit(level: Level, sink: (...a: unknown[]) => void, label: string, args: unknown[]) {
  if (!enabled(level)) return;
  sink(`${label} ${ts()}`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', console.debug, '[debug]', args),
  info: (...args: unknown[]) => emit('info', console.log, '[info] ', args),
  warn: (...args: unknown[]) => emit('warn', console.warn, '[warn] ', args),
  error: (...args: unknown[]) => emit('error', console.error, '[error]', args),
};
