import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

@Schema({ timestamps: true })
export class EmailMessage {
    @Prop({ required: true, enum: ['me', 'them'] })
    sender: string;

    @Prop({ required: true })
    text: string;

    @Prop({ default: Date.now })
    timestamp: Date;

    @Prop()
    email: string;

    @Prop()
    subject: string;
}

export const EmailMessageSchema = SchemaFactory.createForClass(EmailMessage);

@Schema({ timestamps: true })
export class Email extends Document {
    @Prop({ type: MongooseSchema.Types.Mixed, ref: 'Contact', required: true })
    contact: any;

    @Prop({ type: MongooseSchema.Types.Mixed, ref: 'User', required: true })
    user: any;

    @Prop({ type: [EmailMessageSchema], default: [] })
    messages: EmailMessage[];
}

export const EmailSchema = SchemaFactory.createForClass(Email);
