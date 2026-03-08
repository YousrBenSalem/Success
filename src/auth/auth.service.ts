import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthDto } from './dto/auth.dto';
import * as argon2 from 'argon2';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) { }
  async signIn(data: AuthDto) {
    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    const passwordMatches = await argon2.verify(user.password, data.password);
    if (!passwordMatches) {
      throw new BadRequestException('Password is incorrect');
    }
    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return { user, tokens };
  }
  async logout(userId: string) {
    return this.userService.update(userId, { refreshToken: null });
  }
  hashData(data: string) {
    return argon2.hash(data);
  }
  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await this.hashData(refreshToken);
    await this.userService.update(userId, { refreshToken: hashedRefreshToken });
  }

  async getTokens(userId: string, email: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          role,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_TOKEN'),
          expiresIn: '1h',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          role,
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_TOKEN'),
          expiresIn: '7d',
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userService.findOne(userId);
    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');
    const refreshTokenMatches = await argon2.verify(
      user.refreshToken,
      refreshToken,
    );
    if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');
    const tokens = await this.getTokens(user._id, user.email, user.role);
    await this.updateRefreshToken(user._id, tokens.refreshToken);
    return tokens;
  }

  async forgotPassword(email: string) {
    try {
      const existing = await this.userService.findByEmail(email);
      if (!existing) {
        throw new NotFoundException('user not found');
      } else {
        const token = await this.jwtService.signAsync(
          {
            id: existing._id, // Use _id for Mongoose document
            email: existing.email,
            role: existing.role,
          },
          {
            secret: this.configService.get<string>('JWT_ACCESS_TOKEN'), // Should ideally be a separate secret
            expiresIn: '10m',
          },
        );
        await this.userService.update(existing._id, { resetToken: token });
        const options = {
          to: existing.email,
          subject: 'Reset your password',
          html: `<h1>Reset your password</h1>
                 <p>Click the link below to reset your password. This link expires in 10 minutes.</p>
                 <a href="http://localhost:5173/reset-password/${token}">Reset Password</a>`,
        };
        await this.mailerService.sendMail(options);
        return {
          success: true,
          message: 'Reset link sent to your email',
        };
      }
    } catch (error) {
      throw new BadRequestException(error.message || 'Error executing forgot password');
    }
  }

  async resetPassword(token: string, password: string) {
    try {
      const verifiedToken = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_TOKEN'),
      });

      if (!verifiedToken) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const user = await this.userService.findOne(verifiedToken.id);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // No need to hash here, userService.update handles it
      await this.userService.update(user._id, {
        password: password,
        resetToken: null
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };

    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
