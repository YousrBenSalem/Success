import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Types } from 'mongoose';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';

@Controller('users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('super')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) { }

  // =========================
  // CREATE USER
  // =========================
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Body() createUserDto: CreateUserDto, @Res() res) {
    try {
      const user = await this.userService.create(createUserDto);
      return res.status(HttpStatus.CREATED).json({
        message: 'User created successfully',
        data: user,
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
  // FIND ALL USERS + PAGINATION
  // =========================
  @UseGuards(AccessTokenGuard)
  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('role') role = '',
    @Res() res,
  ) {
    try {
      const result = await this.userService.findAll(+page, +limit, search, role);

      return res.status(HttpStatus.OK).json({
        message: 'Users retrieved successfully',
        ...result,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to retrieve users',
      });
    }
  }

  // =========================
  // FIND ONE USER BY ID
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
      const user = await this.userService.findOne(id);
      return res.status(HttpStatus.OK).json({
        message: 'User retrieved successfully',
        data: user,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }

  // =========================
  // CHANGE PASSWORD
  // =========================
  @Patch(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req,
    @Res() res,
  ) {
    try {
      // Security Check: Only allow user to change their own password
      const requester = req.user;

      // If needed, super admin could force change, but usually this flow implies knowing old password.
      // If super admin forces, they usually use the admin update (without old pass).
      // So this specific endpoint is for "I know my password and want to change it".
      if (requester.sub !== id) {
        return res.status(HttpStatus.FORBIDDEN).json({
          message: 'You can only change your own password',
        });
      }

      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid User ID',
        });
      }

      const user = await this.userService.changePassword(id, changePasswordDto);
      return res.status(HttpStatus.OK).json({
        message: 'Password changed successfully',
        data: user,
      });
    } catch (error) {
      this.logger.error(error.message);
      // Return 400 for bad password, 404 for not found
      const status = error.message.includes('Invalid current') ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        message: error.message,
      });
    }
  }

  // =========================
  // UPDATE USER
  // =========================
  @UseGuards(AccessTokenGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Res() res,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid User ID',
        });
      }
      const user = await this.userService.update(id, updateUserDto);
      return res.status(HttpStatus.OK).json({
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      this.logger.error(error.message);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: error.message,
      });
    }
  }

  // =========================
  // DELETE USER
  // =========================
  @UseGuards(AccessTokenGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid User ID',
        });
      }
      const result = await this.userService.remove(id);
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
