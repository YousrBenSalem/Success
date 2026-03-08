import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  campaignType?: string;

  @IsString()
  @IsOptional()
  messageContent?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedContactIds?: string[];

  @IsBoolean()
  @IsOptional()
  filterChannels?: boolean;

  @IsBoolean()
  @IsOptional()
  disableClaims?: boolean;

  @IsBoolean()
  @IsOptional()
  timeZoneScheduling?: boolean;

  @IsBoolean()
  @IsOptional()
  isSelectAll?: boolean;

  @IsBoolean()
  @IsOptional()
  isGroup?: boolean;
}
