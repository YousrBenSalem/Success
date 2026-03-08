import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  Patch,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';
import axios from 'axios';

@Controller('conversations')
@UseGuards(AccessTokenGuard)
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    @InjectModel('Conversation')
    private readonly conversationModel: Model<any>,
    @InjectModel('Contact')
    private readonly contactModel: Model<any>,
  ) {}

  @Get()
  async findAll(@Req() req) {
    const userId = req.user.sub || req.user.id || req.user._id;
    this.logger.log(
      `DEBUG: FindAll Conversations for user: ${userId} (Full user: ${JSON.stringify(req.user)})`,
    );
    const matchUser = {
      $in: [
        userId,
        ...(Types.ObjectId.isValid(userId) ? [new Types.ObjectId(userId)] : []),
      ],
    };
    try {
      const conversations = await this.conversationModel
        .find({ user: matchUser })
        .populate('contact')
        .lean()
        .exec();

      this.logger.log(
        `Found ${conversations.length} conversations for user ${userId} using match: ${JSON.stringify(matchUser)}`,
      );
      if (conversations.length > 0) {
        const first = conversations[0];
        this.logger.debug(
          `First conversation sample: contact=${first.contact?._id || first.contact} (type: ${typeof (first.contact?._id || first.contact)}), user=${first.user} (type: ${typeof first.user}), messagesCount=${first.messages?.length}`,
        );
        this.logger.debug(
          `Raw First Conv: ${JSON.stringify(first).slice(0, 500)}`,
        );
      }

      return conversations;
    } catch (error) {
      this.logger.error(
        `Failed to find conversations: ${error.stack || error.message}`,
      );
      return [];
    }
  }

  @Get(':contactId')
  async findOne(@Param('contactId') contactId: string, @Req() req) {
    const userId = req.user.sub || req.user.id || req.user._id;
    const matchUser = {
      $in: [
        userId,
        ...(Types.ObjectId.isValid(userId) ? [new Types.ObjectId(userId)] : []),
      ],
    };
    const matchContact = {
      $in: [
        contactId,
        ...(Types.ObjectId.isValid(contactId)
          ? [new Types.ObjectId(contactId)]
          : []),
      ],
    };
    try {
      const conversation = await this.conversationModel
        .findOne({ user: matchUser, contact: matchContact })
        .populate('contact')
        .lean()
        .exec();
      this.logger.log(
        `FindOne conversation for contact ${contactId}: ${conversation ? 'Found' : 'Not Found'}`,
      );
      return conversation;
    } catch (error) {
      this.logger.error(
        `Failed to find conversation: ${error.stack || error.message}`,
      );
      return null;
    }
  }

  @Get('admin/cleanup')
  async cleanupDuplicates() {
    this.logger.log('Starting manual cleanup of duplicate conversations...');
    try {
      const allConvs = await this.conversationModel.find({}).lean().exec();
      const groups: Record<string, any[]> = {};

      allConvs.forEach((conv) => {
        const userId = String(conv.user);
        const contactId = String(conv.contact);
        const key = `${userId}-${contactId}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(conv);
      });

      let mergedCount = 0;
      for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
          group.sort((a, b) => String(a._id).localeCompare(String(b._id)));
          const master = group[0];
          const duplicates = group.slice(1);

          let mergedMessages = [...(master.messages || [])];
          for (const dupe of duplicates) {
            const dupeMsgs = dupe.messages || [];
            dupeMsgs.forEach((dm) => {
              if (
                !mergedMessages.find(
                  (mm) =>
                    String(mm.timestamp) === String(dm.timestamp) &&
                    mm.text === dm.text,
                )
              ) {
                mergedMessages.push(dm);
              }
            });
          }
          mergedMessages.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

          await this.conversationModel.updateOne(
            { _id: master._id },
            {
              $set: {
                messages: mergedMessages,
                unreadCount: 0,
                lastMessageAt:
                  mergedMessages.length > 0
                    ? mergedMessages[mergedMessages.length - 1].timestamp
                    : new Date(),
              },
            },
          );
          await this.conversationModel.deleteMany({
            _id: { $in: duplicates.map((d) => d._id) },
          });
          mergedCount++;
        }
      }
      return { success: true, mergedGroups: mergedCount };
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @Patch(':contactId/read')
  async markAsRead(@Param('contactId') contactId: string, @Req() req) {
    const userId = req.user.sub || req.user.id || req.user._id;
    const matchUser = {
      $in: [
        userId,
        ...(Types.ObjectId.isValid(userId) ? [new Types.ObjectId(userId)] : []),
      ],
    };
    const matchContact = {
      $in: [
        contactId,
        ...(Types.ObjectId.isValid(contactId)
          ? [new Types.ObjectId(contactId)]
          : []),
      ],
    };

    await this.conversationModel.updateOne(
      { user: matchUser, contact: matchContact },
      { $set: { unreadCount: 0 } },
    );
    return { success: true };
  }

  @Post('send')
  async sendMessage(
    @Body() body: { contactId: string; text: string },
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.id || req.user._id;
    const { contactId, text } = body;

    const matchUser = {
      $in: [
        userId,
        ...(Types.ObjectId.isValid(userId) ? [new Types.ObjectId(userId)] : []),
      ],
    };
    const matchContact = {
      $in: [
        contactId,
        ...(Types.ObjectId.isValid(contactId)
          ? [new Types.ObjectId(contactId)]
          : []),
      ],
    };

    try {
      // 1. Try to find existing conversation first to avoid upsert issues with $in
      let conversation = await this.conversationModel.findOne({
        user: matchUser,
        contact: matchContact,
      });

      // if (conversation) {
      //     // Update existing
      //     conversation = await this.conversationModel.findByIdAndUpdate(
      //         conversation._id,
      //         {
      //             $push: {
      //                 messages: {
      //                     sender: 'me',
      //                     text: text,
      //                     timestamp: new Date(),
      //                 },
      //             },
      //             $set: {
      //                 unreadCount: 0,
      //                 lastMessageAt: new Date()
      //             }
      //         },
      //         { new: true }
      //     ).populate('contact');
      // } else {
      //     // Create new
      //     conversation = await this.conversationModel.create({
      //         user: userId, // Store as string by default as it's more common in this DB
      //         contact: contactId,
      //         messages: [{
      //             sender: 'me',
      //             text: text,
      //             timestamp: new Date(),
      //         }],
      //         unreadCount: 0,
      //         lastMessageAt: new Date()
      //     });
      //     conversation = await conversation.populate('contact');
      // }

      // 2. Fetch contact details for n8n if not populated or to ensure fresh data
      const contact = await this.contactModel.findById(contactId).lean().exec();

      if (contact) {
        // 3. Send to n8n Webhook
        try {
          const n8nPayload = {
            userId: userId,
            contacts: [
              {
                id: contact._id,
                nom: `${contact.firstName} ${contact.lastName}`,
                email: contact.email,
                telephone: contact.mobile,
              },
            ],
            message: text,
            type: 'sms', // Direct message from chat is SMS
          };

          this.logger.log(
            `Sending direct message to n8n: ${JSON.stringify(n8nPayload)}`,
          );

          const n8nResponse = await axios.post(
            'https://mon-n8n-67jj.onrender.com/webhook/74a6a0df-c672-4eaa-9214-a2294b1ecb62',
            n8nPayload,
          );
          this.logger.log(`n8n direct message status: ${n8nResponse.status}`);
        } catch (n8nError) {
          this.logger.error(`n8n direct message failed: ${n8nError.message}`);
        }
      }

      return conversation;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }
}
