
require('console-stamp')(console, {
    pattern: 'HH:MM:ss.l',
    metadata: '[' + process.pid + ']'
});
const gameServer = require('./src/MultiDBGameServer');
var GameServer = new gameServer();