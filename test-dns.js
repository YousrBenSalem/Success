const dns = require('dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const hostname = 'cluster0-shard-00-00.i36truk.mongodb.net';

console.log('Resolving', hostname, 'using servers:', dns.getServers());

dns.resolve4(hostname, (err, addresses) => {
    if (err) {
        console.error('Resolution failed:', err);
        process.exit(1);
    }
    console.log('Resolved addresses:', addresses);
    process.exit(0);
});
