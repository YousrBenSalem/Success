import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Meeting {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    date: Date;

    @Prop({ required: true })
    time: string;

    @Prop({ required: true })
    contact: string;

    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    type: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    user: any;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);
