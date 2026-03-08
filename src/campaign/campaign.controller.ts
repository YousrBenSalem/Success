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
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Types } from 'mongoose';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';

@Controller('campaigns')
export class CampaignController {
  private readonly logger = new Logger(CampaignController.name);

  constructor(private readonly campaignService: CampaignService) { }

  // =========================
  // CREATE CAMPAIGN
  // =========================
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Body() createCampaignDto: CreateCampaignDto, @Req() req, @Res() res) {
    try {
      const { campaign, recipientsCount, status } = await this.campaignService.create(createCampaignDto, req.user.sub);
      return res.status(HttpStatus.CREATED).json({
        message: 'Campaign created successfully',
        data: campaign,
        recipientsCount: recipientsCount,
        status: status,
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
  // FIND ALL CAMPAIGNS + PAGINATION
  // =========================
  @UseGuards(AccessTokenGuard)
  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Req() req,
    @Res() res,
  ) {
    try {
      const { data, total } = await this.campaignService.findAll(+page, +limit, req.user.sub);
      return res.status(HttpStatus.OK).json({
        message: 'Campaigns retrieved successfully',
        data,
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to retrieve campaigns',
      });
    }
  }

  // =========================
  // FIND ONE CAMPAIGN
  // =========================
  @UseGuards(AccessTokenGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Res() res) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid Campaign ID',
        });
      }

      const campaign = await this.campaignService.findOne(id);
      return res.status(HttpStatus.OK).json({
        message: 'Campaign retrieved successfully',
        data: campaign,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }

  // =========================
  // UPDATE CAMPAIGN
  // =========================
  @UseGuards(AccessTokenGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @Res() res,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid Campaign ID',
        });
      }

      const campaign = await this.campaignService.update(id, updateCampaignDto);

      return res.status(HttpStatus.OK).json({
        message: 'Campaign updated successfully',
        data: campaign,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }

  // =========================
  // DELETE CAMPAIGN
  // =========================
  @UseGuards(AccessTokenGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid Campaign ID',
        });
      }

      const result = await this.campaignService.remove(id);
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
