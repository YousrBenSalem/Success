const mongoose = require('mongoose');

// Use the URI from your .env
const uri = 'mongodb+srv://n8nconnection:Yosr123!@cluster0.i36truk.mongodb.net/saas?appName=Cluster0';

async function cleanup() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const conversationsCol = db.collection('conversations');

        // 1. Get all conversations
        const allConvs = await conversationsCol.find({}).toArray();
        console.log(`Found ${allConvs.length} total conversations`);

        // 2. Group by normalized user/contact
        const groups = {};
        allConvs.forEach(conv => {
            const userId = String(conv.user);
            const contactId = String(conv.contact);
            const key = `${userId}-${contactId}`;

            if (!groups[key]) groups[key] = [];
            groups[key].push(conv);
        });

        // 3. Process groups with duplicates
        for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
                console.log(`\nMerging duplicates for ${key} (${group.length} docs found)`);

                // Sort by ID or timestamp if available to pick the oldest/main one
                group.sort((a, b) => String(a._id).localeCompare(String(b._id)));

                const master = group[0];
                const duplicates = group.slice(1);

                let mergedMessages = [...(master.messages || [])];
                let totalUnread = master.unreadCount || 0;

                for (const dupe of duplicates) {
                    // Avoid duplicates in messages if possible (match by timestamp and text)
                    const dupeMsgs = dupe.messages || [];
                    dupeMsgs.forEach(dm => {
                        if (!mergedMessages.find(mm => String(mm.timestamp) === String(dm.timestamp) && mm.text === dm.text)) {
                            mergedMessages.push(dm);
                        }
                    });
                    totalUnread += (dupe.unreadCount || 0);
                }

                // Sort messages by timestamp
                mergedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Update master
                await conversationsCol.updateOne(
                    { _id: master._id },
                    {
                        $set: {
                            messages: mergedMessages,
                            unreadCount: totalUnread > 50 ? 1 : totalUnread, // Sanity check for the loop data
                            lastMessageAt: mergedMessages.length > 0 ? mergedMessages[mergedMessages.length - 1].timestamp : new Date()
                        }
                    }
                );
                console.log(`Master ${master._id} updated with ${mergedMessages.length} messages.`);

                // Delete duplicates
                const dupeIds = duplicates.map(d => d._id);
                const deleteResult = await conversationsCol.deleteMany({ _id: { $in: dupeIds } });
                console.log(`Deleted ${deleteResult.deletedCount} duplicates.`);
            }
        }

        console.log('\nCleanup finished successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
