import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ICampaign } from './interfaces/campaign-interface';
import axios from 'axios';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectModel('Campaign')
    private readonly campaignModel: Model<ICampaign>,
    @InjectModel('Conversation')
    private readonly conversationModel: Model<any>,
    @InjectModel('Contact')
    private readonly contactModel: Model<any>,
  ) {}

  // =========================
  // CREATE & SEND
  // =========================
  async create(
    createCampaignDto: CreateCampaignDto,
    userId: string,
  ): Promise<{ campaign: ICampaign; recipientsCount: number; status: string }> {
    this.logger.log(
      `Creating campaign: ${createCampaignDto.name} (${createCampaignDto.campaignType}) for user ${userId}`,
    );
    const { selectedContactIds, isSelectAll, isGroup, ...campaignData } =
      createCampaignDto;
    this.logger.log(`Saving campaign to database...`);
    const campaign = await this.campaignModel.create({
      ...campaignData,
      user: new Types.ObjectId(userId),
      contacts: isSelectAll ? [] : selectedContactIds,
      isGroup: isGroup || false,
      status: isGroup ? 'group' : 'processing',
    });

    if (isGroup) {
      this.logger.log(`Campaign ${campaign._id} saved as contact group only.`);
      return { campaign, recipientsCount: 0, status: 'group' };
    }

    // 2. Fetch contacts for n8n payload
    let contacts: any[] = [];
    if (isSelectAll) {
      this.logger.log(
        `'Select All' requested. Fetching all contacts for user ${userId}...`,
      );
      contacts = await this.contactModel.find({ user: userId }).lean().exec();
    } else {
      contacts = await this.contactModel
        .find({ _id: { $in: selectedContactIds } })
        .lean()
        .exec();
    }
    this.logger.log(`Found ${contacts.length} contacts for payload`);

    // 3. Handle SMS/Conversation logic
    // if (campaignData.campaignType === 'sms') {
    //   const contactIdsForConv = contacts.map(c => c._id);
    //   for (const contactId of contactIdsForConv) {
    //     await this.conversationModel.findOneAndUpdate(
    //       { contact: new Types.ObjectId(contactId), user: new Types.ObjectId(userId) },
    //       {
    //         $setOnInsert: {
    //           contact: new Types.ObjectId(contactId),
    //           user: new Types.ObjectId(userId),
    //         },
    //         $push: {
    //           messages: {
    //             sender: 'me',
    //             text: campaignData.messageContent,
    //             timestamp: new Date(),
    //           },
    //         },
    //       },
    //       { upsert: true, new: true },
    //     );
    //   }
    // }

    // 4. Send to n8n Webhook
    let recipientsCount = contacts.length;
    let finalStatus = 'processing';
    try {
      const n8nPayload = {
        user: userId,
        campaignId: campaign._id,
        contacts: contacts.map((c) => ({
          id: c._id,
          nom: `${c.firstName} ${c.lastName}`,
          email: c.email,
          telephone: c.mobile,
        })),

        message: campaignData.messageContent,
        type: campaignData.campaignType,
        subject: campaignData.subject || '',
      };

      this.logger.log(
        `Sending payload to n8n (Async Trigger). CampaignID: ${campaign._id}`,
      );

      // We use a timeout to avoid waiting too long for n8n to finish large batches
      // If it takes > 10s, we return 'processing' and let the frontend poll.
      const response = await axios.post(
        'https://mon-n8n-67jj.onrender.com/webhook/74a6a0df-c672-4eaa-9214-a2294b1ecb62',
        n8nPayload,
        {
          timeout: 10000, // 10 seconds timeout for initial response
        },
      );

      if (response.data) {
        if (
          response.data.status === 'success' &&
          typeof response.data.totalSent === 'number'
        ) {
          recipientsCount = response.data.totalSent;
          finalStatus = 'completed';
          // Update status in DB if n8n returned immediately with result
          await this.campaignModel.findByIdAndUpdate(campaign._id, {
            status: 'completed',
            processedRecipients: recipientsCount,
          });
        } else if (Array.isArray(response.data)) {
          recipientsCount = response.data.length;
          finalStatus = 'completed';
          await this.campaignModel.findByIdAndUpdate(campaign._id, {
            status: 'completed',
            processedRecipients: recipientsCount,
          });
        }
      }

      this.logger.log(
        `n8n webhook check (10s lock). Status: ${response.status}, Processed: ${recipientsCount}, FinalStatus: ${finalStatus}`,
      );
    } catch (error) {
      if (
        error.code === 'ECONNABORTED' ||
        (error.response && error.response.status === 524)
      ) {
        this.logger.warn(
          `n8n webhook is taking a long time (Timeout/524). Switching to Polling mode for Campaign ${campaign._id}`,
        );
        // Leave as 'processing' - n8n is still working
        finalStatus = 'processing';
      } else if (error.response) {
        this.logger.error(
          `n8n webhook failed. Status: ${error.response.status}`,
        );
        finalStatus = 'failed';
        await this.campaignModel.findByIdAndUpdate(campaign._id, {
          status: 'failed',
        });
      } else {
        this.logger.error(
          `Exception while triggering n8n webhook: ${error.message}`,
        );
        finalStatus = 'failed';
        await this.campaignModel.findByIdAndUpdate(campaign._id, {
          status: 'failed',
        });
      }
    }

    return { campaign, recipientsCount, status: finalStatus };
  }

  // =========================
  // FIND ALL (pagination)
  // =========================
  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
  ): Promise<{ data: ICampaign[]; total: number }> {
    limit = Math.min(limit, 100);
    const skip = (page - 1) * limit;

    const query = userId
      ? { user: { $in: [userId, new Types.ObjectId(userId)] } }
      : {};

    const [data, total] = await Promise.all([
      this.campaignModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.campaignModel.countDocuments(query).exec(),
    ]);

    return { data, total };
  }

  // =========================
  // FIND ONE
  // =========================
  async findOne(id: string): Promise<ICampaign> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid campaign id');
    }

    // Attempt to populate contacts if they are IDs
    const campaign = await this.campaignModel
      .findById(id)
      .populate('contacts')
      .lean()
      .exec();

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  // =========================
  // UPDATE
  // =========================
  async update(
    id: string,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<ICampaign> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid campaign id');
    }

    const campaign = await this.campaignModel.findByIdAndUpdate(
      id,
      updateCampaignDto,
      {
        new: true, // retourne le document modifié
        runValidators: true, // applique class-validator
      },
    );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    this.logger.log(`Campaign updated: ${campaign.name}`);
    return campaign;
  }

  // =========================
  // DELETE
  // =========================
  async remove(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid campaign id');
    }

    const campaign = await this.campaignModel.findByIdAndDelete(id);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    this.logger.warn(`Campaign deleted: ${campaign.name}`);

    return { message: 'Campaign deleted successfully' };
  }
}
