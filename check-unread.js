const mongoose = require('mongoose');
const uri = 'mongodb+srv://n8nconnection:Yosr123!@cluster0.i36truk.mongodb.net/saas?appName=Cluster0';
mongoose.connect(uri).then(async () => {
    const convs = await mongoose.connection.db.collection('conversations').find({ unreadCount: { $gt: 0 } }).toArray();
    console.log('Unread Counts > 0:');
    convs.forEach(c => {
        console.log(`- ID: ${c._id}, Contact: ${c.contact}, Unread: ${c.unreadCount}`);
    });
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
