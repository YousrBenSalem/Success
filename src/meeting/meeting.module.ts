import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingService } from './meeting.service';
import { MeetingController } from './meeting.controller';
import { MeetingSchema } from './entities/meeting.entity';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Meeting', schema: MeetingSchema }]),
        MailerModule,
    ],
    controllers: [MeetingController],
    providers: [MeetingService],
    exports: [MeetingService],
})
export class MeetingModule { }
