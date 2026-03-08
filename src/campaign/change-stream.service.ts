import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from './entities/conversation.entity';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChangeStreamService implements OnModuleInit {
    private readonly logger = new Logger(ChangeStreamService.name);

    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
        private chatGateway: ChatGateway,
    ) { }

    async onModuleInit() {
        // One-time reset to fix corrupted unreadCounts
        try {
            await this.conversationModel.updateMany(
                { unreadCount: { $gt: 50 } }, // Reset if unusually high or just reset all
                { $set: { unreadCount: 1 } } // Set to 1 so the badge shows something meaningful but not huge
            );

            // Merge duplicate conversations for same (user, contact)
            const allConvs = await this.conversationModel.find({}).lean().exec();
            const groups: Record<string, any[]> = {};
            allConvs.forEach(conv => {
                const userId = String(conv.user);
                const contactId = String(conv.contact);
                const key = `${userId}-${contactId}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(conv);
            });

            for (const key in groups) {
                const group = groups[key];
                if (group.length > 1) {
                    group.sort((a, b) => String(a._id).localeCompare(String(b._id)));
                    const master = group[0];
                    const duplicates = group.slice(1);

                    let mergedMessages = [...(master.messages || [])];
                    for (const dupe of duplicates) {
                        const dupeMsgs = dupe.messages || [];
                        dupeMsgs.forEach(dm => {
                            if (!mergedMessages.find(mm => String(mm.timestamp) === String(dm.timestamp) && mm.text === dm.text)) {
                                mergedMessages.push(dm);
                            }
                        });
                    }
                    mergedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    await this.conversationModel.updateOne(
                        { _id: master._id },
                        {
                            $set: {
                                messages: mergedMessages,
                                unreadCount: 1, // Merge into 1 unread message for notice
                                lastMessageAt: mergedMessages.length > 0 ? mergedMessages[mergedMessages.length - 1].timestamp : new Date()
                            }
                        }
                    );
                    await this.conversationModel.deleteMany({ _id: { $in: duplicates.map(d => d._id) } });
                    this.logger.log(`Merged duplicate group for ${key}`);
                }
            }
            this.logger.log(`Startup cleanup finished`);
        } catch (err) {
            this.logger.error(`Startup cleanup failed: ${err.message}`);
        }

        this.watchConversations();
    }

    private watchConversations() {
        const changeStream = this.conversationModel.watch([], { fullDocument: 'updateLookup' });

        changeStream.on('change', async (change: any) => {
            try {
                if (change.operationType === 'update' || change.operationType === 'insert') {
                    const doc = change.fullDocument;
                    if (!doc) return;

                    // IMPORTANT: To avoid infinite loop, check if 'messages' was actually modified
                    const updatedFields = change.updateDescription?.updatedFields || {};
                    const isMessageUpdate = change.operationType === 'insert' ||
                        Object.keys(updatedFields).some(key => key.startsWith('messages'));

                    if (!isMessageUpdate) return;

                    const messages = doc.messages || [];
                    if (messages.length === 0) return;

                    const lastMsg = messages[messages.length - 1];

                    // If the last message is from 'them', trigger notification
                    if (lastMsg.sender === 'them') {
                        this.logger.log(`New incoming message detected for user ${doc.user} from contact ${doc.contact}`);

                        // Increment unread count in DB
                        await this.conversationModel.updateOne(
                            { _id: doc._id },
                            {
                                $inc: { unreadCount: 1 },
                                $set: { lastMessageAt: lastMsg.timestamp || new Date() }
                            }
                        );

                        // Notify via socket
                        this.chatGateway.emitToUser(String(doc.user), 'messages:update', {
                            conversationId: doc._id,
                            contactId: doc.contact,
                            message: lastMsg,
                            unreadCount: (doc.unreadCount || 0) + 1
                        });
                    } else {
                        // Signal a generic update even if it's from 'me' (to sync tabs)
                        this.chatGateway.emitToUser(String(doc.user), 'messages:update', {
                            conversationId: doc._id,
                            contactId: doc.contact,
                            message: lastMsg,
                            unreadCount: doc.unreadCount || 0
                        });
                    }
                }
            } catch (error) {
                this.logger.error(`Error processing change stream: ${error.message}`);
            }
        });

        changeStream.on('error', (error) => {
            this.logger.error(`Change Stream Error: ${error.message}`);
            // Restart watch on error after a delay
            setTimeout(() => this.watchConversations(), 5000);
        });
    }
}
