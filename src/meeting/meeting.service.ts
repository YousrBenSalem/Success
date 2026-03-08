import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meeting } from './entities/meeting.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MeetingService {
    private readonly logger = new Logger(MeetingService.name);

    constructor(
        @InjectModel('Meeting') private readonly meetingModel: Model<Meeting>,
        private readonly mailerService: MailerService,
    ) { }

    async create(createMeetingDto: CreateMeetingDto): Promise<Meeting> {
        this.logger.log(`Creating meeting: ${JSON.stringify(createMeetingDto)}`);
        const meeting = new this.meetingModel(createMeetingDto);
        const savedMeeting = await meeting.save();

        // Send invitation email
        try {
            this.logger.log(`Sending invitation email to ${createMeetingDto.email}...`);
            await this.mailerService.sendMail({
                to: createMeetingDto.email,
                subject: `Invitation: ${createMeetingDto.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h1 style="color: #2563eb;">Meeting Invitation</h1>
                        <p>You have been invited to a meeting.</p>
                        <div style="background-color: #f3f4f6; padding: 20px; rounded-xl; margin: 20px 0;">
                            <p><strong>Title:</strong> ${createMeetingDto.title}</p>
                            <p><strong>Date:</strong> ${createMeetingDto.date}</p>
                            <p><strong>Time:</strong> ${createMeetingDto.time}</p>
                            <p><strong>Contact:</strong> ${createMeetingDto.contact}</p>
                        </div>
                        <p>Regards,<br/>The Scheduler Team</p>
                    </div>
                `,
            });
            this.logger.log(`Invitation email sent Successfully to ${createMeetingDto.email}`);
        } catch (error) {
            this.logger.error(`Failed to send invitation email: ${error.message}`);
            // We don't want to fail the meeting creation if email fails, 
            // but the user wants to know why it's not working.
        }

        return savedMeeting;
    }

    async findAll(userId: string): Promise<Meeting[]> {
        return await this.meetingModel
            .find({ user: userId })
            .sort({ date: 1, time: 1 })
            .exec();
    }
}
