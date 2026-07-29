import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { FirebaseService } from './services/firebase.service';
import { RbacService } from './services/rbac.service';
import { RbacSyncService } from './services/rbac-sync.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    FirebaseService,
    RbacService,
    RbacSyncService,
  ],
  exports: [AuthService, TokenService, RbacService, PasswordService],
})
export class AuthModule {}
