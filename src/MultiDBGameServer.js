var WsServer = require('ws');
var reelPool = require('../config/reelPool');
var gamePool = require('../config/gamePool');
const TFakeMoney = require('./FakeMoneyClass');


class TGameServer {
    constructor() {
        this.connections = {};
        this.connectionid = 0;
        this.server = new WsServer.Server({
            port: 9100
        });
        this.server.on('connection', this.onConnection.bind(this));
        console.log('GameServer Start');
    }

    onConnection(ws) {
        this.sessionListAdd(ws);
        ws.onmessage = this.onMessage.bind(this);
        ws.onclose = this.onClose.bind(this, ws);
    }

    onMessage(evt) {
        var _obj = this.getObjAtSessionList(evt.target.id);

        try {
            var _data = JSON.parse(evt.data);
        } catch (error) {
            var _result = {};
            _result.code = 1;
            _result.message = error;
            this.sendErrorPacket(_obj, _result);
            return;
        }

        var _packetStatus = this.getUserPacketStatusAtSessionList(_obj);
        if (!_packetStatus) {
            var _result = {};
            _result.code = 2;
            _result.message = '_packetStatus Empty error';
            this.sendErrorPacket(_obj, _result);
            return;
        }
        this.sessionListUpdateUserPacketId(_obj, _data.id);
        switch (_packetStatus) {
            case 'GameInit':
                try {
                    var _method = _data.method;
                    var _gameId = _data.params.gameId;
                    var _gameToken = _data.params.operatorId;
                } catch (error) {
                    var _result = {};
                    _result.code = 3;
                    _result.message = error;
                    this.sendErrorPacket(_obj, _result);
                    return;
                }
                if (_method == 'agp.game.authenticate') {
                    this.sessionListUpdateGameId(_obj, _gameToken);
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.authGameAndUser(_obj, gamePool, _gameId, _gameToken);
                    //====================================================================
                } else {
                    var _error = {};
                    _error.code = 4;
                    _error.message = 'GameInit';
                    this.sendErrorPacket(_obj, _error);
                }
                break;
            case 'GameRegister':
                var _method = _data.method;
                var _reelDB = this.getReelDBAtSessionList(_obj);
                var _gameToken = this.getGameTokenAtSessionList(_obj);
                if (_method == 'slotGameRegister') {
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.getGameInitPacket(_obj, reelPool, gamePool, _reelDB, _gameToken);
                    //====================================================================
                } else {
                    var _error = {}; _error.code = 5;
                    _error.message = 'GameRegister';
                    this.sendErrorPacket(_obj, _error);
                }
                break;
            case 'GameIdle':
                var _method = _data.method;
                var _reelDB = this.getReelDBAtSessionList(_obj);
                var _gameId = this.getGameIdAtSessionList(_obj);
                var _gameToken = this.getGameTokenAtSessionList(_obj);
                var _betMultiplier = _data.params.betMultiplier;
                if (_method == 'slotGamePlay') {
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.getGameRTP(_obj, gamePool, _reelDB, _gameId, _gameToken, _betMultiplier);
                    //====================================================================
                    // this.getFreeGameIntroPacket(_obj, pool, _reelDB, _gameId, _gameToken, _betMultiplier, 0);
                    // this.getGambleOrTakePacket(_obj, pool, _reelDB, _gameId, _gameToken, _betMultiplier, 0);
                } else {
                    var _error = {}; _error.code = 6;
                    _error.message = 'GameIdle';
                    this.sendErrorPacket(_obj, _error);
                }
                break;
            case 'FreeGameIntro':
                var _method = _data.method;
                //var _reelDB = this.getReelDBAtSessionList(_obj);
                //var _gameId = this.getGameIdAtSessionList(_obj);
                var _gameToken = this.getGameTokenAtSessionList(_obj);
                //var _betMultiplier = _data.params.betMultiplier;
                if (_method == 'slotFreeGameIntro') {
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.getFreeGameStartPacket(_obj, reelPool, gamePool, _gameToken);
                    //====================================================================
                } else {
                    var _error = {}; _error.code = 7;
                    _error.message = 'FreeGameIntro';
                    this.sendErrorPacket(_obj, _error);
                }
                break;
            case 'FreeGame':
                var _method = _data.method;
                var _reelDB = this.getReelDBAtSessionList(_obj);
                var _gameId = this.getGameIdAtSessionList(_obj);
                var _gameToken = this.getGameTokenAtSessionList(_obj);
                var _betMultiplier = this.getFreeGameMultiplierAtSessionList(_obj);
                if (_method == 'slotFreeGamePlay') {
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.getFreeGamePacket(_obj, gamePool, _gameId, _gameToken, _betMultiplier);
                    //====================================================================
                } else {
                    var _error = {}; _error.code = 8;
                    _error.message = 'FreeGame';
                    this.sendErrorPacket(_obj, _error);
                }
                break;

            case 'FreeGameOutro':
                var _method = _data.method;
                //var _reelDB = this.getReelDBAtSessionList(_obj);
                //var _gameId = this.getGameIdAtSessionList(_obj);
                var _gameToken = this.getGameTokenAtSessionList(_obj);
                //var _betMultiplier = this.getFreeGameMultiplierAtSessionList(_obj);
                if (_method == 'slotFreeGameOutro') {
                    //====================================================================
                    // 2019.07.29
                    // ??????DB ??? REELDB ????????? ?????? DB ?????? ??????
                    this.getFreeGameOutroEndPacket(_obj, gamePool, _gameToken);
                    //====================================================================
                } else {
                    var _error = {}; _error.code = 9;
                    _error.message = 'FreeGameOutro';
                    this.sendErrorPacket(_obj, _error);
                }
                break;

        }
    }

    onClose(obj) {
        this.setUserGameToken(obj, gamePool, '');
    }
    // ====================================================
    // 2019.07.13
    // _betMultiplier ?????? (1,2,4,10,50,100,200,500,1000);
    // _betMultiplier ?????? (1,2,4,10,50);
    betMultiplierUpdate(value) {
        if (value >= 100) {
            value = 50;
        }
        return value;
    }
    // ====================================================

    // ====================================================
    // ???????????? ??????
    // ?????? ?????????????????? ??????
    sessionListAdd(obj) {
        this.connectionid++;
        obj.id = this.connectionid;
        this.connections[obj.id] = obj;
        this.connections[obj.id].packetId = 0;
        this.connections[obj.id].packetStatus = 'GameInit';
        this.connections[obj.id].userName = '';
        this.connections[obj.id].userId = '';
        this.connections[obj.id].gameName = '';
        this.connections[obj.id].gameId = '';
        this.connections[obj.id].freeGameList = [];
        this.connections[obj.id].freeGamebetMultiplier = 1;
        this.connections[obj.id].gameToken = '';
        this.connections[obj.id].currentPaylines = 0;
        this.connections[obj.id].reelDB = '';
        this.connections[obj.id].fakeMoney = new TFakeMoney();
        // console.log(this.connections);
    }

    sessionListDel(obj) {
        if (this.connections[obj.id]) {
            this.connections[obj.id].packetId = undefined;
            this.connections[obj.id].packetStatus = undefined;
            this.connections[obj.id].userName = undefined;
            this.connections[obj.id].userId = undefined;
            this.connections[obj.id].gameName = undefined;
            this.connections[obj.id].gameId = undefined;
            this.connections[obj.id].freeGameList = undefined;
            this.connections[obj.id].freeGamebetMultiplier = undefined;
            this.connections[obj.id].gameToken = undefined;
            this.connections[obj.id].currentPaylines = undefined;
            this.connections[obj.id].reelDB = undefined;
            if (this.connections[obj.id].fakeMoney) {
                this.connections[obj.id].fakeMoney.destroy();
                this.connections[obj.id].fakeMoney = undefined;
            }
            delete this.connections[obj.id];
            // console.log(this.connections);
        }
    }

    getObjAtSessionList(id) {
        return this.connections[id];
    }

    // ????????????????????? ?????? ??????ID ??????, ??????
    sessionListUpdateUserPacketId(obj, id) {
        if (this.connections[obj.id])
            this.connections[obj.id].packetId = id;
    }
    getUserPacketIdAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].packetId;
    }
    // ?????????????????? ?????? ???????????? ??????, ??????
    sessionListUpdateUserPacketStatus(obj, packetStatus) {
        if (this.connections[obj.id])
            this.connections[obj.id].packetStatus = packetStatus;
    }
    getUserPacketStatusAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].packetStatus;
    }
    // ????????????????????? ?????? ?????? ??????, ??????
    sessionListUpdateUserName(obj, userName) {
        if (this.connections[obj.id])
            this.connections[obj.id].userName = userName;
    }
    getUserNameAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].userName;
    }
    // ????????????????????? ?????? ????????? ??????, ??????
    sessionListUpdateUserId(obj, userId) {
        if (this.connections[obj.id])
            this.connections[obj.id].userId = userId;
    }
    getUserIdAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].userId;
    }
    // ????????????????????? ???????????? ??????, ??????
    sessionListUpdateGameName(obj, gameName) {
        if (this.connections[obj.id])
            this.connections[obj.id].gameName = gameName;
    }
    getGameNameAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].gameName;
    }
    // ????????????????????? ??????????????? ??????, ??????
    sessionListUpdateGameId(obj, gameId) {
        if (this.connections[obj.id])
            this.connections[obj.id].gameId = gameId;
    }
    getGameIdAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].gameId;
    }
    // ????????????????????? ?????? FreeGame ?????? QUEUE ????????? ?????????
    sessionListFreeGamePacketListInit(obj) {
        if (this.connections[obj.id])
            this.connections[obj.id].freeGameList = [];
    }
    // ????????????????????? ?????? FreeGame ?????? QUEUE ????????? PUSH
    sessionListFreeGamePacketListPush(obj, freeGamePacket) {
        if (this.connections[obj.id])
            this.connections[obj.id].freeGameList = freeGamePacket;
    }
    // ?????? FreeGame ?????? QUEUE ??????????????? FreeGame POP SEND
    sessionListFreeGamePacketListPop(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].freeGameList.shift();
    }
    // ?????? freeGamebetMultiplier ??????, ??????
    sessionListFreeGameMultiplier(obj, freeGamebetMultiplier) {
        if (this.connections[obj.id])
            this.connections[obj.id].freeGamebetMultiplier = freeGamebetMultiplier;
    }
    getFreeGameMultiplierAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].freeGamebetMultiplier;
    }
    // ????????????????????? ???????????? ??????, ??????
    sessionListUpdateGameToken(obj, gameToken) {
        if (this.connections[obj.id])
            this.connections[obj.id].gameToken = gameToken;
    }
    getGameTokenAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].gameToken;
    }
    // ????????????????????? currentPaylines ??????, ??????
    sessionListUpdateCurrentPaylines(obj, currentPaylines) {
        if (this.connections[obj.id])
            this.connections[obj.id].currentPaylines = currentPaylines;
    }
    getCurrentPaylinesAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].currentPaylines;
    }
    // ????????????????????? reelDB ??????, ??????
    sessionListUpdateReelDB(obj, reelDB) {
        if (this.connections[obj.id])
            this.connections[obj.id].reelDB = reelDB;
    }
    getReelDBAtSessionList(obj) {
        if (this.connections[obj.id])
            return this.connections[obj.id].reelDB;
    }
    // ====================================================


    // ====================================================
    getWinResultAtSessionList(obj) {
        if (this.connections[obj.id]) {
            return this.connections[obj.id].fakeMoney.getWinResult();
        }
    }

    getWinMoneyAtSessionList(obj, betMultiplier) {
        if (this.connections[obj.id]) {
            var _payLines = this.getCurrentPaylinesAtSessionList(obj);
            var _wager = parseInt(_payLines * betMultiplier);
            console.log('getWinMoneyAtSessionList _wager', _wager, betMultiplier, _payLines);
            return this.connections[obj.id].fakeMoney.getWinMoney(_wager, _payLines);
        }
    }

    setLoseCountAtSessionList(obj, count) {
        if (this.connections[obj.id]) {
            return this.connections[obj.id].fakeMoney.setLoseCount(count);
        }
    }
    // ====================================================


    // ====================================================
    // DB ?????? ??????
    // ???????????????, ?????????????????? ????????????()
    authGameAndUser(obj, con, gameId, gameToken) {
        var _result = {};
        {
            // ???????????? ??????
            var _sql = 'CALL GetGameInfoByGameId(?)';
            var _para = gameId;
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    // ?????? ?????? ??????
                    _result.code = 10;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {
                    var _data = results[0];
                    _result.status = 'ok';
                    try {
                        _result.gameId = _data[0].gameId;
                        _result.gameName = _data[0].gameName;
                        _result.reelDB = _data[0].reelDB;
                        _result.currentPaylines = _data[0].payLines;
                    } catch (error) {
                        _result.code = 11;
                        _result.message = error;
                        this.sendErrorPacket(obj, _result);
                        return;
                    }

                    // ?????? ????????? ??????
                    this.sessionListUpdateGameId(obj, _result.gameId);
                    // ?????? ReelDB ??????
                    this.sessionListUpdateReelDB(obj, _result.reelDB);
                    // ?????? ?????? ??????
                    this.sessionListUpdateGameName(obj, _result.gameName);
                    // Paylines ??????
                    this.sessionListUpdateCurrentPaylines(obj, _result.currentPaylines);
                    {
                        // ?????? ??????
                        var _sql = 'CALL GetUserNameByGameToken(?)';
                        var _para = gameToken;
                        con.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 12;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                _result.status = 'ok';
                                try {
                                    _result.userName = _data[0].userName;
                                } catch (error) {
                                    _result.code = 13;
                                    _result.message = error;
                                    this.sendErrorPacket(obj, _result);
                                    return;
                                }
                                // ?????? ?????? ??????
                                this.sessionListUpdateGameToken(obj, gameToken);
                                // ?????? ?????? ??????
                                this.sessionListUpdateUserName(obj, _result.userName);
                                // ?????? ??? ?????? ?????? ?????? ?????? ??????
                                this.sendUserInfo(obj, _result);
                                // GameRegister ??? ??????
                                this.sessionListUpdateUserPacketStatus(obj, 'GameRegister');
                            }
                        });
                    }
                }
            });
        }
    }

    // ?????? ?????? INIT ?????? ??????(????????????)
    getGameInitPacket(obj, con, con1, reelDB, gameToken) {
        var _result = {};
        {
            // init ?????? ??????
            var _sql = 'CALL ' + reelDB + '.SelectStartGameIdle()';
            var _para = '';
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    _result.code = 14;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {
                    var _data = results[0];
                    _result.status = 'ok';
                    _result.gameIdle = _data[0].GameIdle;
                    {
                        // ?????? ?????? ??????
                        var _sql = 'CALL GetUserBalanceByGameToken(?)';
                        var _para = gameToken;
                        con1.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 15;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                _result.status = 'ok';
                                var _data = results[0];
                                try {
                                    _result.balance = _data[0].balance;
                                } catch (error) {
                                    _result.code = 16;
                                    _result.message = error;
                                    this.sendErrorPacket(obj, _result);
                                    return;
                                }
                                this.sendGameInitPacket(obj, _result);
                                this.sessionListUpdateUserPacketStatus(obj, 'GameIdle');
                            }
                        });
                    }
                }
            });
        }
    }

    // GameRTP ????????????
    getGameRTP(obj, con, reelDB, gameId, gameToken, betMultiplier) {
        var _result = {};
        {
            var _sql = 'CALL GameTokenAuth(?)';
            var _para = gameToken;
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0 || (results[0])[0].status == 'error') {
                    _result.code = 17;
                    _result.message = 'GameTokenAuth';
                    this.sendErrorPacket(obj, _result);
                } else {
                    // RTP ??????
                    var _sql = 'CALL GetGameRTP(?)';
                    var _para = gameId;
                    con.query(_sql, _para, (error, results, fields) => {
                        if (error || results[0].length == 0) {
                            _result.code = 18;
                            _result.message = error;
                            this.sendErrorPacket(obj, _result);
                        } else {
                            var _data = results[0];
                            try {
                                _result.fixRTP = _data[0].fixRTP;
                                _result.nowRTP = _data[0].nowRTP;

                                // ========================================================================
                                // 2019.12.20 : FakeMoney
                                _result.baseGameRTP = _data[0].baseGameRTP;
                                _result.freeGameRTP = _data[0].freeGameRTP;
                                _result.fakeFreeGameRTP = _data[0].fakeFreeGameRTP;
                                _result.gameRTP = _data[0].gameRTP;
                                // ========================================================================
                            } catch (error) {
                                _result.code = 19;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                                return;
                            }

                            if (_result.nowRTP <= _result.fixRTP || _result.nowRTP == 0) {
                                if (Math.random() > parseFloat(_result.baseGameRTP)) {
                                    this.setLoseCountAtSessionList(obj, 0);
                                    if (Math.random() > parseFloat(_result.freeGameRTP)) {
                                        this.getGambleOrTakePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, 0);
                                    } else {
                                        this.getFreeGameIntroPacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, 0);
                                    }
                                } else {
                                    this.getGameIdlePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier);
                                }
                            } else {
                                if (this.getWinResultAtSessionList(obj)) {
                                    var _winMoney = this.getWinMoneyAtSessionList(obj, betMultiplier);
                                    this.setLoseCountAtSessionList(obj, 0);
                                    if (Math.random() > parseFloat(_result.fakeFreeGameRTP)) {
                                        console.log('gameSpinQuery _winMoney', _winMoney);
                                        this.getGambleOrTakePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, _winMoney);
                                    } else {
                                        _winMoney = parseInt(_winMoney * (Math.random() * 10) * (Math.random() * 10));
                                        console.log('gameSpinQuery rand _winMoney', _winMoney);
                                        this.getFreeGameIntroPacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, _winMoney);
                                    }
                                } else {
                                    this.getGameIdlePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier);
                                }
                            }
                            /*
                            if (_result.nowRTP <= _result.fixRTP || _result.nowRTP == 0) {
                                if (Math.random() > 0.01) {
                                    this.getGambleOrTakePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, 0);
                                } else {
                                    this.getFreeGameIntroPacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier, 0);
                                }
                            } else {
                                this.getGameIdlePacket(obj, reelPool, gamePool, reelDB, gameId, gameToken, betMultiplier);
                            }
                            */
                        }
                    });
                }
            });
        }
    }

    // GameIdle ?????? ?????? ??? ?????? ????????????, ????????????, ???????????? ??????
    getGameIdlePacket(obj, con, con1, reelDB, gameId, gameToken, betMultiplier) {
        var _result = {};
        {
            // GameIdle ?????? ??????
            var _sql = 'CALL ' + reelDB + '.SelectRunGameIdle()';
            var _para = '';
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    _result.code = 20;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {

                    var _data = results[0];
                    try {
                        _result.gameIdle = _data[0].GameIdle;
                        _result.gameIdleNo = _data[0].GameIdleNo;
                    } catch (error) {
                        _result.code = 21;
                        _result.message = error;
                        this.sendErrorPacket(obj, _result);
                        return;
                    }

                    {
                        // SetUserBetGameIdleProcess
                        var _sql = 'CALL SetUserBetGameIdleProcess(?, ?, ?, ?)';
                        var _para = [gameToken, gameId, _result.gameIdleNo, betMultiplier];
                        con1.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 22;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // GameIdle ?????? ????????? ????????? ??????
                                    // ???????????????, balance, roundId, currentBetMultiplier
                                    _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                    _result.balance = _data[0].balance;
                                    _result.roundId = _data[0].roundId;
                                    _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                    this.sendGameIdlePacket(obj, _result);
                                    this.sessionListUpdateUserPacketStatus(obj, 'GameIdle');
                                } else {
                                    _result.code = 23;
                                    _result.message = error;
                                    this.sendErrorPacket(obj, _result);
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    // GambleOrTake ?????? ?????? ??? ?????? ?????? ?????? SEND
    getGambleOrTakePacket(obj, con, con1, reelDB, gameId, gameToken, betMultiplier, baseGameWin) {
        var _result = {};
        {
            // GambleOrTake ?????? ??????
            var _sql = 'CALL ' + reelDB + '.SelectRunGambleOrTake(?)';
            var _para = baseGameWin; // 1?????? ?????????
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    _result.code = 24;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {
                    var _data = results[0];
                    _result.gambleOrTake = _data[0].GambleOrTake;
                    _result.gambleOrTakeNo = _data[0].GambleOrTakeNo;
                    _result.baseGameWin = _data[0].baseGameWin;
                    {
                        // SetUserBetGambleOrTakeProcess
                        var _sql = 'CALL SetUserBetGambleOrTakeProcess(?, ?, ?, ?, ?)';
                        var _para = [gameToken, gameId, _result.gambleOrTakeNo, betMultiplier, _result.baseGameWin];
                        con1.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 25;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // GamebleOrTake ?????? ??????
                                    // ???????????????, currentBetMultiplier, totalWager, totalBaseGameWin, baseGameWin, totalWin, balance, roundId
                                    _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                    _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                    _result.totalWager = _data[0].totalWager;
                                    _result.totalBaseGameWin = _data[0].totalBaseGameWin;
                                    _result.baseGameWin = _data[0].baseGameWin;
                                    _result.totalWin = _data[0].totalWin;
                                    _result.balance = _data[0].balance;
                                    _result.roundId = _data[0].roundId;
                                    this.sendGambleOrTakePacket(obj, _result);
                                    this.sessionListUpdateUserPacketStatus(obj, 'GameIdle');
                                } else {
                                    _result.code = 26;
                                    _result.message = 'SetUserBetGambleOrTakeProcess';
                                    this.sendErrorPacket(obj, _result);
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    // FreeGameIntro ?????? ?????? ??? ?????? ?????? ?????? SEND
    getFreeGameIntroPacket(obj, con, con1, reelDB, gameId, gameToken, betMultiplier, totalWin) {
        var _result = {};
        {
            // FreeGameIntro ?????? ??????
            var _sql = 'CALL ' + reelDB + '.SelectRunFreeGame(?)';
            var _para = totalWin; // ???????????? ?????? ?????? (1??????)
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    _result.code = 27;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {
                    this.sessionListFreeGamePacketListInit(obj);
                    this.sessionListFreeGameMultiplier(obj, betMultiplier); // ??????????????? betMultiplier ??????
                    this.sessionListFreeGamePacketListPush(obj, results[0]);
                    var _data = this.sessionListFreeGamePacketListPop(obj);
                    _result.freeGameIntroNo = _data.FreeGameNo;
                    _result.freeGameIntro = _data.FreeGame;
                    _result.baseGameWin = _data.baseGameWin; // ???????????? ???????????? baseGameWin ???????????? ??????(1??????)
                    _result.state = _data.state;
                    if (_result.state == 'FreeGameIntro') {
                        // SetUserBetFreeGameIntroProcess
                        var _sql = 'CALL SetUserBetFreeGameIntroProcess(?, ?, ?, ?, ?)';
                        var _para = [gameToken, gameId, _result.freeGameIntroNo, betMultiplier, _result.baseGameWin];
                        con1.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 28;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // FreeGameIntro ?????? ????????? ????????? ??????
                                    // ???????????????, currentBetMultiplier, totalWager, baseGameWin, balance, roundId,
                                    _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                    _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                    _result.totalWager = _data[0].totalWager;
                                    _result.baseGameWin = _data[0].baseGameWin;
                                    // ????????????????????? total ?????? ????????? ?????? ???????????? betMultiplier ???????????? ??????
                                    //_result.totalBaseGameWin = _data[0].totalBaseGameWin;
                                    // _result.totalWin = _data[0].totalWin;
                                    _result.balance = _data[0].balance;
                                    _result.roundId = _data[0].roundId;
                                    this.sendFreeGameIntroPacket(obj, _result);
                                    this.sessionListUpdateUserPacketStatus(obj, 'FreeGameIntro');
                                } else {
                                    _result.code = 29;
                                    _result.message = 'SetUserBetFreeGameIntroProcess';
                                    this.sendErrorPacket(obj, _result);
                                }
                            }
                        });
                    } else {
                        _result.code = 30;
                        _result.message = 'getFreeGameIntroPacket';
                        this.sendErrorPacket(obj, _result);
                    }
                }
            });
        }
    }

    // FreeGameStart ?????? ?????? ??? ?????? ?????? ?????? SEND
    getFreeGameStartPacket(obj, con, con1, /*reelDB, gameId,*/ gameToken/*, betMultiplier , totalWin*/) {
        var _result = {};
        var _sql = 'CALL GameTokenAuth(?)';
        var _para = gameToken;
        con1.query(_sql, _para, (error, results, fields) => {
            if (error || results[0].length == 0 || (results[0])[0].status == 'error') {
                _result.code = 31;
                _result.message = 'GameTokenAuth';
                this.sendErrorPacket(obj, _result);
            } else {
                var _data = this.sessionListFreeGamePacketListPop(obj);
                _result.freeGameStartNo = _data.FreeGameNo;
                _result.freeGameStart = _data.FreeGame;
                _result.state = _data.state;
                // ???????????? ????????? ????????? ?????? ????????? ??????.
                // _result.totalWin = _data.totalWin;
                if (!_result.freeGameStart || _result.state != 'FreeGame') {
                    _result.code = 32;
                    _result.message = 'getFreeGameStartPacket';
                    this.sendErrorPacket(obj, _result);
                } else {
                    // ?????? ?????? ??????
                    var _sql = 'CALL GetUserBalanceByGameToken(?)';
                    var _para = gameToken;
                    con1.query(_sql, _para, (error, results, fields) => {
                        if (error || results[0].length == 0) {
                            _result.code = 33;
                            _result.message = error;
                            this.sendErrorPacket(obj, _result);
                        } else {
                            var _data = results[0];
                            _result.status = 'ok';
                            // FreeGameStart ?????? ????????? ????????? ??????
                            // ???????????????, currentBetMultiplier, balance
                            _result.packetId = this.getUserPacketIdAtSessionList(obj);
                            _result.currentBetMultiplier = this.getFreeGameMultiplierAtSessionList(obj);
                            _result.balance = _data[0].balance;

                            this.sendFreeGameStartPacket(obj, _result);
                            this.sessionListUpdateUserPacketStatus(obj, 'FreeGame');
                        }
                    });
                }
            }
        });
    }

    getFreeGamePacket(obj, con, /*reelDB,*/ gameId, gameToken, betMultiplier /*, totalWin*/) {
        var _result = {};

        var _sql = 'CALL GameTokenAuth(?)';
        var _para = gameToken;
        con.query(_sql, _para, (error, results, fields) => {
            if (error || results[0].length == 0 || (results[0])[0].status == 'error') {
                _result.code = 34;
                _result.message = 'GameTokenAuth';
                this.sendErrorPacket(obj, _result);
            } else {
                var _data = this.sessionListFreeGamePacketListPop(obj);
                _result.freeGameNo = _data.FreeGameNo;
                _result.freeGame = _data.FreeGame;
                _result.state = _data.state;
                _result.freeGameWin = _data.freeGameWin;
                _result.totalWin = _data.totalWin;
                // console.log('sessionListFreeGamePacketListPop:', _result);
                if (!_result.freeGame || (_result.state != 'FreeGame' && _result.state != 'FreeGameOutro')) {
                    _result.code = 35;
                    _result.message = 'sessionListFreeGamePacketListPop';
                    this.sendErrorPacket(obj, _result);
                } else {
                    // SetUserBetFreeGameProcess
                    var _sql = 'CALL SetUserBetFreeGameProcess(?, ?, ?, ?, ?, ?)';
                    var _para = [gameToken, gameId, _result.freeGameNo, betMultiplier, _result.freeGameWin, _result.state];
                    con.query(_sql, _para, (error, results, fields) => {
                        if (error || results[0].length == 0) {
                            _result.code = 36;
                            _result.message = error;
                            this.sendErrorPacket(obj, _result);
                        } else {
                            var _data = results[0];
                            if (_data[0].status == 'ok') {
                                // FreeGame ?????? ????????? ????????? ??????
                                // ???????????????, currentBetMultiplier, balance, roundId ??? ???????????? ????????? ??????????????? ????????????.
                                _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                _result.balance = _data[0].balance;
                                _result.roundId = _data[0].roundId;
                                this.sendFreeGamePacket(obj, _result);
                                if (_result.state == 'FreeGameOutro') {
                                    this.sessionListUpdateUserPacketStatus(obj, 'FreeGameOutro');
                                }
                            } else {
                                _result.code = 37;
                                _result.message = 'getFreeGamePacket';
                                this.sendErrorPacket(obj, _result);
                            }
                        }
                    });
                }
            }
        });
    }

    getFreeGameOutroEndPacket(obj, con, gameToken) {
        var _result = {};
        var _sql = 'CALL GameTokenAuth(?)';
        var _para = gameToken;
        con.query(_sql, _para, (error, results, fields) => {
            if (error || results[0].length == 0 || (results[0])[0].status == 'error') {
                _result.code = 38;
                _result.message = 'GameTokenAuth';
                this.sendErrorPacket(obj, _result);
            } else {
                var _data = this.sessionListFreeGamePacketListPop(obj);
                _result.freeGameNo = _data.FreeGameNo;
                _result.freeGame = _data.FreeGame;
                _result.state = _data.state;
                _result.freeGameWin = _data.freeGameWin;
                _result.totalWin = _data.totalWin;
                if (!_result.freeGame || _result.state != 'GambleOrTake') {
                    _result.code = 39;
                    _result.message = 'getFreeGameOutroEndPacket';
                    this.sendErrorPacket(obj, _result);
                } else {
                    // ?????? ?????? ??????
                    var _sql = 'CALL GetUserBalanceByGameToken(?)';
                    var _para = gameToken;
                    con.query(_sql, _para, (error, results, fields) => {
                        if (error || results[0].length == 0) {
                            _result.code = 40;
                            _result.message = error;
                            this.sendErrorPacket(obj, _result);
                        } else {
                            var _data = results[0];
                            _result.status = 'ok';
                            // FreeGameOutroEnd ?????? ????????? ????????? ??????
                            // ???????????????, balance, roundId,
                            _result.packetId = this.getUserPacketIdAtSessionList(obj);
                            _result.currentBetMultiplier = this.getFreeGameMultiplierAtSessionList(obj);
                            _result.balance = _data[0].balance;

                            this.sendFreeGameOutroEndPacket(obj, _result);
                            this.sessionListUpdateUserPacketStatus(obj, 'GameIdle');
                        }
                    });
                }
            }
        });
    }

    setUserGameToken(obj, con, value) {
        var _sql = 'CALL SetUserGameToken(?, ?)';
        var _gameToken = this.getGameTokenAtSessionList(obj);
        var _para = [_gameToken, value];
        con.query(_sql, _para, (error, results, fields) => {
            if (error) {
                // _result.status = 'error';
                // _result.message = error;
                // this.sendErrorPacket(obj, _result);
                this.sessionListDel(obj);
            } else {
                this.sessionListDel(obj);
            }
        });
    }
    // ====================================================

    // ???????????? URL ??????
    sendGameUrl() {

    }

    // ?????? ?????? ????????? //{"id":1,"error":{"code":*??????,"message":"?????? ?????????, ?????? ?????????(?????? ????????? ??????)"}}
    sendErrorPacket(obj, data) {
        var _sendData = {};
        // _sendData.id = this.getUserPacketIdAtSessionList(obj);
        // ?????? ?????? ????????????  ??????
        _sendData.id = 99999;
        _sendData.error = {};
        _sendData.error.code = data.code;
        _sendData.error.message = data.message;
        //obj.send(JSON.stringify(_sendData));
        console.log(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    // {"id":1,"result":{"user":"????????????","currency":"FUN","language":"en-US"}} SEND
    sendUserInfo(obj, data) {
        var _sendData = {};
        _sendData.id = this.getUserPacketIdAtSessionList(obj);
        _sendData.result = {};
        _sendData.result.user = data.userName;
        _sendData.result.user = 'demo';
        _sendData.result.currency = 'FUN';
        _sendData.result.language = 'en-US';
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    // ?????? ?????? INIT ?????? ??????(????????????) ??????
    sendGameInitPacket(obj, data) {
        var _sendData = JSON.parse(data.gameIdle);
        _sendData.id = this.getUserPacketIdAtSessionList(obj);
        _sendData.result.balance = data.balance;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    // GameIdle ?????? SEND
    sendGameIdlePacket(obj, data) {
        var _sendData = JSON.parse(data.gameIdle);
        _sendData.id = data.packetId;
        _sendData.result.balance = data.balance;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.roundId = data.roundId;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    // GambleOrTake ?????? SEND
    sendGambleOrTakePacket(obj, data) {
        var _sendData = JSON.parse(data.gambleOrTake);
        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.totalWager = data.totalWager;
        _sendData.result.totalBaseGameWin = data.totalWin;
        _sendData.result.baseGame.baseGameWin = data.baseGameWin;

        var _winLines = _sendData.result.baseGame.winLines;
        if (_winLines != undefined) {
            _sendData.result.baseGame.winLines = [];
            {
                var _length = _winLines.length;
                for (var i = 0; i < _length; i++) {
                    var _strWinLines = _winLines[i];
                    var _arrWinLines = _strWinLines.split(',');
                    _arrWinLines[2] = _arrWinLines[2] * data.currentBetMultiplier;
                    _strWinLines = _arrWinLines.toString();
                    _sendData.result.baseGame.winLines.push(_strWinLines);
                }
            }
        }

        _sendData.result.totalWin = data.totalWin;
        _sendData.result.balance = data.balance;
        _sendData.result.roundId = data.roundId;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    sendFreeGameIntroPacket(obj, data) {
        var _sendData = JSON.parse(data.freeGameIntro);
        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.totalWager = data.totalWager;
        _sendData.result.totalBaseGameWin = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.baseGame.baseGameWin = data.baseGameWin;

        var _winLines = _sendData.result.baseGame.winLines;
        if (_winLines != undefined) {
            _sendData.result.baseGame.winLines = [];
            {
                var _length = _winLines.length;
                for (var i = 0; i < _length; i++) {
                    var _strWinLines = _winLines[i];
                    var _arrWinLines = _strWinLines.split(',');
                    _arrWinLines[2] = _arrWinLines[2] * data.currentBetMultiplier;
                    _strWinLines = _arrWinLines.toString();
                    _sendData.result.baseGame.winLines.push(_strWinLines);
                }
            }
        }
        _sendData.result.totalWin = _sendData.result.totalWin * data.currentBetMultiplier;
        _sendData.result.balance = data.balance;
        _sendData.result.roundId = data.roundId;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    sendFreeGameStartPacket(obj, data) {
        var _sendData = JSON.parse(data.freeGameStart);

        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.totalWager = data.totalWager;

        _sendData.result.totalBaseGameWin = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.baseGame.baseGameWin = _sendData.result.baseGame.baseGameWin * data.currentBetMultiplier;
        _sendData.result.totalWin = _sendData.result.totalWin * data.currentBetMultiplier;

        _sendData.result.balance = data.balance;
        _sendData.result.roundId = data.roundId;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    sendFreeGamePacket(obj, data) {
        // FreeGame ?????? ????????? ????????? ??????
        // ???????????????, currentBetMultiplier, balance, roundId ??? ???????????? ????????? ??????????????? ????????????.
        var _sendData = JSON.parse(data.freeGame);

        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.totalWager = _sendData.result.totalWager * data.currentBetMultiplier;
        _sendData.result.totalBaseGameWin = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.totalFreeGameWin = _sendData.result.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.baseGame.baseGameWin = _sendData.result.baseGame.baseGameWin * data.currentBetMultiplier;

        _sendData.result.freeGame.freeGameWin = _sendData.result.freeGame.freeGameWin * data.currentBetMultiplier;
        _sendData.result.freeGame.totalFreeGameWin = _sendData.result.freeGame.totalFreeGameWin * data.currentBetMultiplier;

        var _winLines = _sendData.result.freeGame.winLines;
        if (_winLines != undefined) {
            _sendData.result.freeGame.winLines = [];
            {
                var _length = _winLines.length;
                for (var i = 0; i < _length; i++) {
                    var _strWinLines = _winLines[i];
                    var _arrWinLines = _strWinLines.split(',');
                    _arrWinLines[2] = _arrWinLines[2] * data.currentBetMultiplier;
                    _strWinLines = _arrWinLines.toString();
                    _sendData.result.freeGame.winLines.push(_strWinLines);
                }
            }
        }

        _sendData.result.totalWin = _sendData.result.totalWin * data.currentBetMultiplier;

        _sendData.result.balance = data.balance;
        _sendData.result.roundId = data.roundId;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    sendFreeGameOutroEndPacket(obj, data) {
        // FreeGameOutroEnd ?????? ????????? ????????? ??????
        // ???????????????, currentBetMultiplier, balance ??? ???????????? ????????? ??????????????? ????????????.
        var _sendData = JSON.parse(data.freeGame);

        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.totalWager = _sendData.result.totalWager * data.currentBetMultiplier;
        _sendData.result.totalBaseGameWin = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.totalFreeGameWin = _sendData.result.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.baseGame.baseGameWin = _sendData.result.baseGame.baseGameWin * data.currentBetMultiplier;

        _sendData.result.freeGame.freeGameWin = _sendData.result.freeGame.freeGameWin * data.currentBetMultiplier;
        _sendData.result.freeGame.totalFreeGameWin = _sendData.result.freeGame.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.totalWin = _sendData.result.totalWin * data.currentBetMultiplier;

        _sendData.result.balance = data.balance;
        // obj.send(JSON.stringify(_sendData));
        this.socketSendData(obj, _sendData)
    }

    // * ?????? ??????, ???????????? ?????? SEND
    setUserInfoAndBetList(obj) {

    }

    socketSendData(obj, sendData) {
        try {
            if (obj.readyState == 1) {
                // console.log(obj.readyState ,sendData);
                obj.send(JSON.stringify(sendData));
            }
        } catch (error) {
            console.log(error);
        }

    }
}

module.exports = TGameServer;