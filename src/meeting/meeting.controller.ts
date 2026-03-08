import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Req,
    HttpStatus,
    Res,
    Logger,
} from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';

@Controller('meetings')
@UseGuards(AccessTokenGuard)
export class MeetingController {
    private readonly logger = new Logger(MeetingController.name);

    constructor(private readonly meetingService: MeetingService) { }

    @Post()
    async create(@Body() createMeetingDto: CreateMeetingDto, @Req() req, @Res() res) {
        try {
            createMeetingDto.user = req.user.sub;
            const meeting = await this.meetingService.create(createMeetingDto);
            return res.status(HttpStatus.CREATED).json({
                message: 'Meeting scheduled successfully',
                data: meeting,
            });
        } catch (error) {
            this.logger.error(error.message);
            return res.status(HttpStatus.BAD_REQUEST).json({
                message: error.message,
            });
        }
    }

    @Get()
    async findAll(@Req() req, @Res() res) {
        try {
            const meetings = await this.meetingService.findAll(req.user.sub);
            return res.status(HttpStatus.OK).json({
                message: 'Meetings retrieved successfully',
                data: meetings,
            });
        } catch (error) {
            this.logger.error(error.message);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: 'Unable to retrieve meetings',
            });
        }
    }
}
