import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The subset of a verified Firebase token we consume. */
export interface FirebaseIdentity {
  uid: string;
  email?: string;
  phoneNumber?: string;
}

/**
 * Verifies Firebase ID tokens. firebase-admin is imported lazily so the dependency is only
 * loaded when Firebase is configured (FIREBASE_PROJECT_ID etc.). When unconfigured, token
 * verification is rejected — local login remains available as the alternative path.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: unknown;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.configured = Boolean(
      config.get('FIREBASE_PROJECT_ID') &&
      config.get('FIREBASE_CLIENT_EMAIL') &&
      config.get('FIREBASE_PRIVATE_KEY'),
    );
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  async verifyIdToken(idToken: string): Promise<FirebaseIdentity> {
    if (!this.configured) {
      throw new UnauthorizedException('Firebase authentication is not configured');
    }
    const admin = await import('firebase-admin');
    this.app ??= admin.apps.length
      ? admin.apps[0]
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.config.get('FIREBASE_PROJECT_ID'),
            clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
          }),
        });
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return { uid: decoded.uid, email: decoded.email, phoneNumber: decoded.phone_number };
    } catch (error) {
      this.logger.warn(`Firebase token verification failed: ${String(error)}`);
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}
