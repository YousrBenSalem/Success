
import {
    Controller,
    Get,
    UseGuards,
    Req,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessTokenGuard } from 'src/common/guards/accessToken.guard';

@Controller('dashboard')
@UseGuards(AccessTokenGuard)
export class DashboardController {
    private readonly logger = new Logger(DashboardController.name);

    constructor(
        @InjectModel('Campaign')
        private readonly campaignModel: Model<any>,
        @InjectModel('Contact')
        private readonly contactModel: Model<any>,
        @InjectModel('Conversation')
        private readonly conversationModel: Model<any>,
        @InjectModel('Email')
        private readonly emailModel: Model<any>,
        @InjectModel('Meeting')
        private readonly meetingModel: Model<any>,
        @InjectModel('User')
        private readonly userModel: Model<any>,
    ) { }

    @Get('stats')
    async getStats(@Req() req) {
        const userId = req.user.sub || req.user.id || req.user._id;
        this.logger.log(`DEBUG: Dashboard request from user: ${JSON.stringify(req.user)}`);
        try {
            const matchUserList: any[] = [userId];
            if (Types.ObjectId.isValid(userId)) {
                matchUserList.push(new Types.ObjectId(userId));
            }
            const matchUser = { $in: matchUserList };

            this.logger.log(`Fetching dashboard stats for user: ${userId} (Match list: ${JSON.stringify(matchUserList)})`);

            const [totalContacts, totalCampaigns, totalConversations, totalEmails, totalMeetings, totalAdmins] = await Promise.all([
                this.contactModel.countDocuments({ user: matchUser }),
                this.campaignModel.countDocuments({ user: matchUser }),
                this.conversationModel.countDocuments({ user: matchUser }),
                this.emailModel.countDocuments({ user: matchUser }),
                this.meetingModel.countDocuments({ user: matchUser }),
                this.userModel.countDocuments({ role: 'admin' }),
            ]);

            // Count total sent messages (sender: 'me') from Emails and Conversations
            const [emailSentAgg, convSentAgg] = await Promise.all([
                this.emailModel.aggregate([
                    { $match: { user: matchUser } },
                    { $unwind: '$messages' },
                    { $match: { 'messages.sender': 'me' } },
                    { $count: 'count' }
                ]),
                this.conversationModel.aggregate([
                    { $match: { user: matchUser } },
                    { $unwind: '$messages' },
                    { $match: { 'messages.sender': 'me' } },
                    { $count: 'count' }
                ])
            ]);

            const totalSentMessages = (emailSentAgg[0]?.count || 0) + (convSentAgg[0]?.count || 0);

            this.logger.log(`Counts -> Contacts: ${totalContacts}, Campaigns: ${totalCampaigns}, Conv: ${totalConversations}, Emails: ${totalEmails}, Sent Messages: ${totalSentMessages}, Meetings: ${totalMeetings}, Admins: ${totalAdmins}`);

            // Aggregate stats from all user campaigns (keeping it for reference but won't be primary)
            const campaignStats = await this.campaignModel.aggregate([
                { $match: { user: matchUser } },
                {
                    $group: {
                        _id: null,
                        totalQueued: { $sum: '$queued' },
                        totalSent: { $sum: '$sent' },
                        totalDelivered: { $sum: '$delivered' },
                        totalUndelivered: { $sum: '$undelivered' },
                        totalResponse: { $sum: '$response' },
                        totalFailed: { $sum: '$failed' },
                        totalStop: { $sum: '$stop' },
                        totalSpam: { $sum: '$spam' },
                    }
                }
            ]);

            const aggregated = campaignStats[0] || {
                totalQueued: 0, totalSent: 0, totalDelivered: 0, totalUndelivered: 0,
                totalResponse: 0, totalFailed: 0, totalStop: 0, totalSpam: 0
            };

            const messagesDeliveredPercent = aggregated.totalSent > 0
                ? ((aggregated.totalDelivered / aggregated.totalSent) * 100).toFixed(1)
                : 100; // Default to 100 if no campaigns

            const [userDoc, recentCampaigns, recentContacts, recentMeetings, recentEmails, recentConvs] = await Promise.all([
                this.userModel.findById(userId).lean().exec() as Promise<any>,
                this.campaignModel.find({ user: matchUser }).sort({ createdAt: -1 }).limit(3).lean().exec(),
                this.contactModel.find({ user: matchUser }).sort({ createdAt: -1 }).limit(3).lean().exec(),
                this.meetingModel.find({ user: matchUser }).sort({ createdAt: -1 }).limit(3).lean().exec() as Promise<any[]>,
                this.emailModel.find({ user: matchUser }).populate('contact').sort({ updatedAt: -1 }).limit(5).lean().exec() as Promise<any[]>,
                this.conversationModel.find({ user: matchUser }).populate('contact').sort({ updatedAt: -1 }).limit(5).lean().exec() as Promise<any[]>,
            ]);

            const creditsRemaining = (userDoc as any)?.credits || 0;

            const activityItems = [
                ...recentCampaigns.map((c: any) => ({
                    id: c._id,
                    action: 'Campaign Sent',
                    target: c.name,
                    time: this.formatTime(c.createdAt),
                    timestamp: new Date(c.createdAt).getTime(),
                    status: 'Completed'
                })),
                ...recentContacts.map((c: any) => ({
                    id: c._id,
                    action: 'Contact Added',
                    target: `${c.firstName} ${c.lastName}`,
                    time: this.formatTime(c.createdAt),
                    timestamp: new Date(c.createdAt).getTime(),
                    status: 'Completed'
                })),
                ...recentMeetings.map((m: any) => ({
                    id: m._id,
                    action: 'Meeting Scheduled',
                    target: m.title,
                    time: this.formatTime(m.createdAt),
                    timestamp: new Date(m.createdAt).getTime(),
                    status: 'Pending'
                })),
                ...recentEmails.map((e: any) => {
                    const lastMsg = e.messages?.[e.messages.length - 1];
                    return {
                        id: e._id,
                        action: 'Email Sent',
                        target: lastMsg?.email || 'N/A',
                        time: this.formatTime(e.updatedAt),
                        timestamp: new Date(e.updatedAt).getTime(),
                        status: 'Completed'
                    };
                }),
                ...recentConvs.map((c: any) => {
                    const lastMsg = c.messages?.[c.messages.length - 1];
                    return {
                        id: c._id,
                        action: 'Message Sent',
                        target: c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'N/A',
                        time: this.formatTime(c.updatedAt),
                        timestamp: new Date(c.updatedAt).getTime(),
                        status: lastMsg?.sender === 'me' ? 'Sent' : 'Received'
                    };
                })
            ];

            // Sort by timestamp desc and take top 5
            const activity = activityItems
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5);

            // Get history of sent/received messages for the last 10 days - Optimized to single aggregation
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 9);
            tenDaysAgo.setHours(0, 0, 0, 0);

            const [emailHistoryAgg, convHistoryAgg] = await Promise.all([
                this.emailModel.aggregate([
                    { $match: { user: matchUser, updatedAt: { $gte: tenDaysAgo } } },
                    { $unwind: '$messages' },
                    {
                        $group: {
                            _id: {
                                day: { $dayOfMonth: '$updatedAt' },
                                month: { $month: '$updatedAt' },
                                sender: '$messages.sender'
                            },
                            count: { $sum: 1 }
                        }
                    }
                ]),
                this.conversationModel.aggregate([
                    { $match: { user: matchUser, updatedAt: { $gte: tenDaysAgo } } },
                    { $unwind: '$messages' },
                    {
                        $group: {
                            _id: {
                                day: { $dayOfMonth: '$updatedAt' },
                                month: { $month: '$updatedAt' },
                                sender: '$messages.sender'
                            },
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            const history: any[] = [];
            for (let i = 9; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const day = date.getDate();
                const month = date.getMonth() + 1; // MongoDB months are 1-12

                const eSent = emailHistoryAgg.find(h => h._id.day === day && h._id.month === month && h._id.sender === 'me')?.count || 0;
                const eRecv = emailHistoryAgg.find(h => h._id.day === day && h._id.month === month && h._id.sender === 'them')?.count || 0;
                const cSent = convHistoryAgg.find(h => h._id.day === day && h._id.month === month && h._id.sender === 'me')?.count || 0;
                const cRecv = convHistoryAgg.find(h => h._id.day === day && h._id.month === month && h._id.sender === 'them')?.count || 0;

                history.push({
                    date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
                    sent: eSent + cSent,
                    received: eRecv + cRecv,
                });
            }

            // Combine recent emails and conversations for a "Recent Communications" list
            const communications = [
                ...recentEmails.map(e => {
                    const lastMsg = e.messages?.[e.messages.length - 1];
                    const rawDate = e.updatedAt || e.createdAt || lastMsg?.timestamp;
                    return {
                        id: e._id,
                        type: 'Email',
                        contact: e.contact ? `${e.contact.firstName} ${e.contact.lastName}` : 'N/A',
                        subject: lastMsg?.subject || 'No Subject',
                        time: this.formatTime(rawDate),
                        rawDate: rawDate,
                        status: 'Sent'
                    };
                }),
                ...recentConvs.map(c => {
                    const lastMsg = c.messages?.[c.messages.length - 1];
                    const rawDate = c.updatedAt || c.createdAt || lastMsg?.timestamp;
                    return {
                        id: c._id,
                        type: 'Message',
                        contact: c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'N/A',
                        subject: lastMsg?.text || 'No content',
                        time: this.formatTime(rawDate),
                        rawDate: rawDate,
                        status: 'Received'
                    };
                })
            ].sort((a, b) => {
                const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
                const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
                return dateB - dateA;
            }).slice(0, 10);

            return {
                stats: {
                    totalContacts,
                    totalCampaigns,
                    totalEmails,
                    totalSentMessages,
                    totalMeetings,
                    totalAdmins,
                    messagesDelivered: `${messagesDeliveredPercent}%`,
                    creditsRemaining,
                    delivered: aggregated.totalDelivered,
                    responded: aggregated.totalResponse,
                    undelivered: aggregated.totalUndelivered,
                    stop: aggregated.totalStop,
                    spam: aggregated.totalSpam,
                },
                recentActivity: activity,
                communications,
                history,
            };
        } catch (error) {
            this.logger.error(`Dashboard stats error: ${error.stack || error.message}`);
            return {
                stats: {
                    totalContacts: 0,
                    totalCampaigns: 0,
                    totalEmails: 0,
                    totalSentMessages: 0,
                    totalMeetings: 0,
                    totalAdmins: 0,
                    messagesDelivered: '0%',
                    creditsRemaining: 0,
                },
                recentActivity: [],
                communications: [],
                history: [],
            };
        }
    }

    private formatTime(date: any) {
        if (!date) return 'Unknown';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Unknown';

        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} mins ago`;
        if (hours < 24) return `${hours} hours ago`;
        return `${days} days ago`;
    }
}
