import { Injectable } from '@nestjs/common';
import type { DevicePlatform, DeviceToken } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class DeviceRepository extends TenantRepository {
  /** Register or refresh a device token (re-points it at the current user, re-activates it). */
  register(
    userId: string,
    token: string,
    platform: DevicePlatform,
    deviceType?: string,
  ): Promise<DeviceToken> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.deviceToken.findUnique({ where: { token } });
      if (existing) {
        return tx.deviceToken.update({
          where: { token },
          data: {
            userId,
            platform,
            active: true,
            lastSeenAt: new Date(),
            ...(deviceType !== undefined ? { deviceType } : {}),
          },
        });
      }
      return tx.deviceToken.create({
        data: { tenantId, userId, token, platform, deviceType: deviceType ?? null },
      });
    });
  }

  /** Revoke a single device (e.g. on logout). */
  remove(userId: string, token: string): Promise<unknown> {
    return this.run((tx) => tx.deviceToken.deleteMany({ where: { userId, token } }));
  }

  /** Deactivate tokens FCM reported as invalid (token cleanup) — keeps the row for audit. */
  deactivateTokens(tokens: string[]): Promise<unknown> {
    if (tokens.length === 0) return Promise.resolve(undefined);
    return this.run((tx) =>
      tx.deviceToken.updateMany({ where: { token: { in: tokens } }, data: { active: false } }),
    );
  }
}
