import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BiometricProviderKind,
  type BiometricProvider,
  type NormalisedPunch,
} from './biometric-provider.port';

/**
 * Registry of biometric/device provider adapters (N5).
 *
 * Providers register themselves by key; ingestion resolves them by key at request time. This is the
 * seam that keeps vendor code out of the attendance domain — swapping or adding a vendor means
 * registering an adapter, never touching the write path.
 *
 * A generic REST adapter ships by default so a school can integrate any device that can POST a
 * webhook, without waiting for a bespoke adapter.
 */
@Injectable()
export class BiometricProviderRegistry {
  private readonly providers = new Map<string, BiometricProvider>();

  constructor() {
    this.register(genericRestProvider);
  }

  register(provider: BiometricProvider): void {
    this.providers.set(provider.key, provider);
  }

  get(key: string): BiometricProvider {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new BadRequestException(
        `Unknown biometric provider "${key}". Registered: ${[...this.providers.keys()].join(', ') || 'none'}`,
      );
    }
    return provider;
  }

  keys(): string[] {
    return [...this.providers.keys()];
  }
}

/**
 * Default vendor-neutral adapter: accepts a JSON batch of punches in Munaxa's own shape. Devices
 * that cannot emit this shape get a thin adapter of their own rather than a special ingestion path.
 */
export const genericRestProvider: BiometricProvider = {
  key: 'generic-rest',
  kind: BiometricProviderKind.REST,
  source: 'BIOMETRIC',
  normalise(payload: unknown): NormalisedPunch[] {
    const items = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.punches)
        ? payload.punches
        : null;
    if (!items) {
      throw new BadRequestException('Expected an array of punches, or { punches: [...] }');
    }
    return items.map((item, index) => {
      if (!isRecord(item)) throw new BadRequestException(`Punch ${index} is not an object`);
      const externalRef = str(item.externalRef ?? item.id);
      const externalUserRef = str(item.externalUserRef ?? item.userRef ?? item.badgeNumber);
      const punchAtRaw = str(item.punchAt ?? item.timestamp);
      const direction = str(item.direction ?? item.type).toUpperCase();
      if (!externalRef) throw new BadRequestException(`Punch ${index} is missing externalRef`);
      if (!externalUserRef) {
        throw new BadRequestException(`Punch ${index} is missing externalUserRef`);
      }
      const punchAt = new Date(punchAtRaw);
      if (Number.isNaN(punchAt.getTime())) {
        throw new BadRequestException(`Punch ${index} has an invalid punchAt`);
      }
      if (direction !== 'IN' && direction !== 'OUT') {
        throw new BadRequestException(`Punch ${index} direction must be IN or OUT`);
      }
      return {
        externalRef,
        externalUserRef,
        punchAt,
        direction,
        deviceId: item.deviceId === undefined ? null : str(item.deviceId),
        raw: item,
      };
    });
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Coerce a provider-supplied field to a string. Only primitives are coerced — objects/arrays yield
 * '' so a malformed payload surfaces as a clear validation error rather than '[object Object]'.
 */
function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}
