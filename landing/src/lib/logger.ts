/**
 * Minimal structured logger. Emits single-line JSON so log aggregators (Datadog, CloudWatch,
 * Grafana Loki, etc.) can parse fields directly. Never log full PII (raw IP + email + message
 * together) at levels above `info` without a documented retention policy.
 */

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'munaxa-landing',
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console -- structured info logs are intentional here
    console.log(line);
  }
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};

/** Masks an IP address for logging (useful for abuse triage without storing it raw). */
export function maskIp(ip: string): string {
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return 'unknown';
}
