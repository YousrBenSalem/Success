import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
  Res,
  HttpStatus,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Types } from 'mongoose';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';

@Controller('contacts')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('super', 'admin')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  constructor(private readonly contactService: ContactService) { }

  // =========================
  // CREATE USER
  // =========================
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Body() createContactDto: CreateContactDto, @Req() req, @Res() res) {
    try {
      // Inject User ID from the authenticated request
      createContactDto.user = req.user.sub;

      const contact = await this.contactService.create(createContactDto);
      return res.status(HttpStatus.CREATED).json({
        message: 'Contact created successfully',
        data: contact,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message,
      });
    }
  }

  @UseGuards(AccessTokenGuard)
  @Post('bulk')
  async createBulk(@Body() createContactDtos: CreateContactDto[], @Req() req, @Res() res) {
    try {
      // Inject User ID into all items
      const contactsWithUser = createContactDtos.map(dto => ({ ...dto, user: req.user.sub }));
      const contacts = await this.contactService.createMany(contactsWithUser);
      return res.status(HttpStatus.CREATED).json({
        message: `${contacts.length} contacts imported successfully`,
        data: contacts,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message,
      });
    }
  }
  // =========================
  // FIND ALL CONTACTS + PAGINATION
  // =========================
  @UseGuards(AccessTokenGuard)
  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('searchBy') searchBy = '',
    @Query('startDate') startDate = '',
    @Query('endDate') endDate = '',
    @Req() req,
    @Res() res,
  ) {
    try {
      const result = await this.contactService.findAll(
        req.user.sub,
        +page,
        +limit,
        search,
        searchBy,
        startDate,
        endDate,
      );

      return res.status(HttpStatus.OK).json({
        message: 'Contacts retrieved successfully',
        ...result,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to retrieve contacts',
      });
    }
  }

  // =========================
  // FIND ONE CONTACT BY ID
  // =========================
  @UseGuards(AccessTokenGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Res() res) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid User ID',
        });
      }
      const contact = await this.contactService.findOne(id);
      return res.status(HttpStatus.OK).json({
        message: 'Contact retrieved successfully',
        data: contact,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }

  // =========================
  // UPDATE CONTACT
  // =========================
  @UseGuards(AccessTokenGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @Res() res,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid Contact ID',
        });
      }
      const contact = await this.contactService.update(id, updateContactDto);
      return res.status(HttpStatus.OK).json({
        message: 'Contact updated successfully',
        data: contact,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }
  // =========================
  // DELETE CONTACT
  // =========================
  @UseGuards(AccessTokenGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid Contact ID',
        });
      }
      const result = await this.contactService.remove(id);
      return res.status(HttpStatus.OK).json({
        message: result.message,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }
}
