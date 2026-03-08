import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { escapeRegExp } from 'src/common/utils/regexp.util';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IUser } from './interfaces/user-interface';
import * as argon2 from 'argon2';


@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel('User')
    private readonly userModel: Model<IUser>,
  ) { }

  // =========================
  // CREATE USER
  // =========================

  async create(dto: CreateUserDto): Promise<IUser> {
    // check duplicate email
    const exists = await this.userModel.findOne({ email: dto.email });

    if (exists) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.userModel.create(dto);

    this.logger.log(`User created: ${user.email}`);

    return user;
  }

  // =========================
  // FIND BY EMAIL
  // =========================

  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email: email });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  // =========================
  // FIND ALL
  // =========================

  async findAll(page = 1, limit = 10, search?: string, role?: string): Promise<any> {
    limit = Math.min(limit, 100);
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      const escapedSearch = escapeRegExp(search);
      const searchRegex = { $regex: escapedSearch, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    } else {
      // Hide super admin by default
      query.role = { $ne: 'super' };
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // =========================
  // FIND ONE
  // =========================

  async findOne(id: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel
      .findById(id)
      .select('-password')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // =========================
  // UPDATE
  // =========================

  async update(id: string, dto: UpdateUserDto): Promise<IUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    if (dto.password) {
      dto.password = await argon2.hash(dto.password);
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, dto, {
        new: true,
        runValidators: true,
      })
      .select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // =========================
  // DELETE
  // =========================

  async remove(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel.findByIdAndDelete(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.warn(`User deleted: ${user.email}`);

    return { message: 'User deleted successfully' };
  }

  // =========================
  // CHANGE PASSWORD
  // =========================

  async changePassword(id: string, dto: any): Promise<IUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel.findById(id).select('+password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await argon2.verify(user.password, dto.oldPassword);
    if (!isMatch) {
      throw new BadRequestException('Invalid current password');
    }

    const hashedPassword = await argon2.hash(dto.newPassword);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { password: hashedPassword }, {
        new: true,
        runValidators: true,
      })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }
}
