/**
 * Firebase session exchange against a real PostgreSQL. Firebase itself is replaced by a stub
 * that returns the identity named by the token, so the test is about what the exchange trusts:
 * an existing Munaxa account is linked by email only when Firebase has verified the address.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/auth/services/rbac.service';
import { FirebaseService, type FirebaseIdentity } from '../src/auth/services/firebase.service';
import { withPlatform } from '../src/prisma/tenant.helpers';
import { RoleKey } from '@school/domain';

const TENANT_ID = '55555555-5555-5555-5555-5555555555f1';
const EMAIL = 'admin@firebase-e2e.example';

const identities: Record<string, FirebaseIdentity> = {
  unverified: { uid: 'firebase-attacker', email: EMAIL, emailVerified: false },
  verified: { uid: 'firebase-owner', email: EMAIL, emailVerified: true },
};

describe('Firebase session exchange (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({
        isConfigured: true,
        verifyIdToken: (token: string) => Promise.resolve(identities[token]),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const rbac = moduleRef.get(RbacService);

    await withPlatform(prisma, async (tx) => {
      await tx.tenant.deleteMany({ where: { id: TENANT_ID } });
      await tx.tenant.create({
        data: { id: TENANT_ID, name: 'Firebase E2E', slug: 'firebase-e2e', status: 'ACTIVE' },
      });
      await rbac.provisionTenantRoles(tx, TENANT_ID);
      const user = await tx.user.create({
        data: { tenantId: TENANT_ID, email: EMAIL, status: 'ACTIVE', mustChangePassword: false },
      });
      userId = user.id;
      await rbac.assignRole(tx, TENANT_ID, user.id, RoleKey.SchoolAdmin);
    });
  });

  afterAll(async () => {
    await withPlatform(prisma, (tx) => tx.tenant.delete({ where: { id: TENANT_ID } }));
    await app.close();
  });

  const exchange = (firebaseIdToken: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/session')
      .send({ firebaseIdToken, tenantSlug: 'firebase-e2e' });

  const linkedUid = () =>
    withPlatform(prisma, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      return user?.firebaseUid ?? null;
    });

  it('refuses an unverified address and leaves the account unlinked', async () => {
    await exchange('unverified').expect(401);
    expect(await linkedUid()).toBeNull();
  });

  it('links a verified address and signs its owner in', async () => {
    const res = await exchange('verified').expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(await linkedUid()).toBe('firebase-owner');
  });

  it('keeps refusing the unverified identity once the account is linked', async () => {
    await exchange('unverified').expect(401);
    expect(await linkedUid()).toBe('firebase-owner');
  });
});
