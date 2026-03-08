import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as argon2 from 'argon2';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 'admin' })
  role: string;

  @Prop({ default: null })
  refreshToken: string;

  @Prop({ default: null })
  resetToken: string;

  @Prop({ default: 0 })
  credits: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

/* =========================
   MONGOOSE MIDDLEWARE
   ========================= */

UserSchema.pre<User>('save', async function (next) {
  // si le password n'a pas changé → ne rien faire
  if (!this.isModified('password')) {
    return;
  }

  // hash du mot de passe
  this.password = await argon2.hash(this.password);

});
