import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  campaignType?: string;

  @Prop({ required: false })
  messageContent?: string;

  @Prop()
  subject?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: any;

  @Prop({ type: [{ type: MongooseSchema.Types.Mixed, ref: 'Contact' }], default: [] })
  contacts: any[];

  @Prop({ default: false })
  filterChannels: boolean;

  @Prop({ default: false })
  disableClaims: boolean;

  @Prop({ default: false })
  timeZoneScheduling: boolean;

  @Prop({ default: 0 })
  queued: number;

  @Prop({ default: 0 })
  sent: number;

  @Prop({ default: 0 })
  delivered: number;

  @Prop({ default: 0 })
  undelivered: number;

  @Prop({ default: 0 })
  response: number;

  @Prop({ default: 0 })
  failed: number;

  @Prop({ default: 0 })
  stop: number;

  @Prop({ default: 0 })
  spam: number;

  @Prop({ default: 'pending', enum: ['pending', 'processing', 'completed', 'failed', 'group'] })
  status: string;

  @Prop({ default: false })
  isGroup: boolean;

  @Prop({ default: 0 })
  processedRecipients: number;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);