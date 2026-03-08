const dns = require('dns');
const { Resolver } = dns;
const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

const hostname = 'cluster0-shard-00-00.i36truk.mongodb.net';

console.log('Resolving', hostname, 'using private resolver instance...');

resolver.resolve4(hostname, (err, addresses) => {
    if (err) {
        console.error('Resolution failed:', err);
        process.exit(1);
    }
    console.log('Resolved addresses:', addresses);
    process.exit(0);
});
