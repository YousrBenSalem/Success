import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IContact } from './interfaces/contact-interface';
import { escapeRegExp } from 'src/common/utils/regexp.util';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel('Contact')
    private readonly contactModel: Model<IContact>,
  ) { }

  // =========================
  // CREATE contact
  // =========================
  async create(createContactDto: CreateContactDto): Promise<IContact> {
    // Optional: check duplicate email per user? Or global?
    // Let's keep it simple for now or scope it to the user if we want
    // const exists = await this.contactModel.findOne({
    //   email: createContactDto.email,
    //   user: createContactDto.user 
    // });

    // if (exists) {
    //   throw new ConflictException('Email already exists for this user');
    // }
    const contact = await this.contactModel.create(createContactDto);
    this.logger.log(`Contact created: ${contact.email}`);
    return contact;
  }

  // =========================
  // FIND ALL
  // =========================
  async findAll(
    userId: string,
    page = 1,
    limit = 10,
    search?: string,
    searchBy?: string, // 'name', 'email', 'company', 'phone'
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    limit = Math.min(limit, 100);
    const skip = (page - 1) * limit;

    const query: any = { user: userId };

    if (search) {
      const escapedSearch = escapeRegExp(search);
      const searchRegex = { $regex: escapedSearch, $options: 'i' };

      if (searchBy) {
        switch (searchBy) {
          case 'name':
            query.$or = [{ firstName: searchRegex }, { lastName: searchRegex }];
            break;
          case 'email':
            query.email = searchRegex;
            break;
          case 'company':
            query.companyName = searchRegex;
            break;
          case 'phone':
            query.mobile = searchRegex;
            break;
          default:
            // Fallback to global if invalid field
            query.$or = [
              { firstName: searchRegex },
              { lastName: searchRegex },
              { email: searchRegex },
              { companyName: searchRegex },
            ];
        }
      } else {
        // Global search
        query.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { companyName: searchRegex },
        ];
      }
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.createdAt = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    }

    const [data, total] = await Promise.all([
      this.contactModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.contactModel.countDocuments(query).exec(),
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
  async findOne(id: string): Promise<IContact> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contact id');
    }
    const contact = await this.contactModel.findById(id).lean().exec();

    if (!contact) {
      throw new NotFoundException('contact not found');
    }

    return contact;
  }
  // =========================
  // UPDATE
  // =========================
  async update(id: string, updateContactDto: UpdateContactDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contact id');
    }

    const contact = await this.contactModel.findByIdAndUpdate(
      id,
      updateContactDto,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }
  // =========================
  // DELETE
  // =========================
  async remove(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contact id');
    }

    const contact = await this.contactModel.findByIdAndDelete(id);

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    this.logger.warn(`contact deleted: ${contact.email}`);

    return { message: 'contact deleted successfully' };
  }

  async createMany(createContactDtos: CreateContactDto[]): Promise<IContact[]> {
    const contacts = await this.contactModel.insertMany(createContactDtos);
    this.logger.log(`${contacts.length} contacts created via bulk upload`);
    return contacts;
  }
}
