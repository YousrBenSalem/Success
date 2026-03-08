import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { AccessTokenStrategy } from './stratégies/accessToken.strategy';
import { refreshTokenStrategy } from './stratégies/refreshToken.strategy';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports:[JwtModule.register({}),UserModule],
  controllers: [AuthController],
  providers: [AuthService , AccessTokenStrategy , refreshTokenStrategy],
})
export class AuthModule {}
