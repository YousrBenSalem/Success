import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateMeetingDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsDateString()
    date: string;

    @IsNotEmpty()
    @IsString()
    time: string;

    @IsNotEmpty()
    @IsString()
    contact: string;

    @IsNotEmpty()
    @IsString()
    email: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsString()
    @IsOptional()
    user?: string;
}
