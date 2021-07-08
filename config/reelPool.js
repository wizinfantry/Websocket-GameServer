var mysql = require('mysql');
var reelCon = mysql.createPool({
    connectionLimit: 10,
    host: '127.0.0.1',
    user: 'user',
    password: 'password',
    database: 'database'
})
reelCon.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Database connection was closed.')
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('Database has too many connections.')
        }
        if (err.code === 'ECONNREFUSED') {
            console.error('Database connection was refused.')
        }
    }
    if (connection) connection.release()
    return
})
module.exports = reelCon;
