import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

@Schema({ timestamps: true })
export class Message {
    @Prop({ required: true, enum: ['me', 'them'] })
    sender: string;

    @Prop({ required: true })
    text: string;

    @Prop({ default: Date.now })
    timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

@Schema({ timestamps: true })
export class Conversation extends Document {
    @Prop({ type: MongooseSchema.Types.Mixed, ref: 'Contact', required: true })
    contact: any;

    @Prop({ type: MongooseSchema.Types.Mixed, ref: 'User', required: true })
    user: any;

    @Prop({ type: [MessageSchema], default: [] })
    messages: Message[];

    @Prop({ default: 0 })
    unreadCount: number;

    @Prop({ default: Date.now })
    lastMessageAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
