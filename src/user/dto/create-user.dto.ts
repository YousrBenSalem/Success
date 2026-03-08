import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsEmpty,
} from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  SUPER = 'super',
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
  @IsEmpty()
  refreshToken: string | null
}
