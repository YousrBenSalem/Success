import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { ConversationController } from './conversation.controller';
import { DashboardController } from './dashboard.controller';
import { ChatGateway } from './chat.gateway';
import { ChangeStreamService } from './change-stream.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignSchema } from './entities/campaign.entity';
import { ConversationSchema } from './entities/conversation.entity';
import { EmailSchema } from './entities/email.entity';
import { ContactModule } from '../contact/contact.module';
import { UserSchema } from '../user/entities/user.entity';
import { MeetingSchema } from 'src/meeting/entities/meeting.entity';

@Module({
  imports: [
    ContactModule,
    MongooseModule.forFeature([
      { name: "Campaign", schema: CampaignSchema },
      { name: "Conversation", schema: ConversationSchema },
      { name: "Email", schema: EmailSchema },
      { name: "User", schema: UserSchema },
      { name: "Meeting", schema: MeetingSchema }
    ])
  ],
  controllers: [CampaignController, ConversationController, DashboardController],
  providers: [CampaignService, ChatGateway, ChangeStreamService],
})
export class CampaignModule { }
