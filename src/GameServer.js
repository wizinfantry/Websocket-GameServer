var WsServer = require('ws');
var pool = require('../config/database');



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
        // console.log('RECV:', evt.data);

        var _obj = this.getObjAtSessionList(evt.target.id);
        var _data = undefined;
        try {
            _data = JSON.parse(evt.data);
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
                    this.authGameAndUser(_obj, pool, _gameId, _gameToken);
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
                    this.getGameInitPacket(_obj, pool, _reelDB, _gameToken);
                } else {
                    var _error = {};
                    _error.code = 5;
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
                    this.getGameRTP(_obj, pool, _reelDB, _gameId, _gameToken, _betMultiplier);
                    // this.getFreeGameIntroPacket(_obj, pool, _reelDB, _gameId, _gameToken, _betMultiplier, 0);
                    // this.getGambleOrTakePacket(_obj, pool, _reelDB, _gameId, _gameToken, _betMultiplier, 0);
                } else {
                    var _error = {};
                    _error.code = 6;
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
                    this.getFreeGameStartPacket(_obj, pool, _gameToken);
                } else {
                    var _error = {};
                    _error.code = 7;
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
                    this.getFreeGamePacket(_obj, pool, _gameId, _gameToken, _betMultiplier);
                } else {
                    var _error = {};
                    _error.code = 8;
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
                    this.getFreeGameOutroEndPacket(_obj, pool, _gameToken);
                } else {
                    var _error = {};
                    _error.code = 9;
                    _error.message = 'FreeGameOutro';
                    this.sendErrorPacket(_obj, _error);
                }
                break;

        }
    }

    onClose(obj) {
        this.setUserGameToken(obj, pool, '');
    }
    // ====================================================
    // 2019.07.13
    // _betMultiplier 정리 (1,2,4,10,50,100,200,500,1000);
    // _betMultiplier 정리 (1,2,4,10,50);
    betMultiplierUpdate(value) {
        if (value >= 100) {
            value = 50;
        }
        return value;
    }
    // ====================================================

    // ====================================================
    // 세션관리 부분
    // 접속 세션리스트에 추가
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
        // console.log(this.connections);
    }

    sessionListDel(obj) {
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
        delete this.connections[obj.id];
        // console.log(this.connections);
    }

    getObjAtSessionList(id) {
        return this.connections[id];
    }

    // 세션리스트에서 유저 패킷ID 변경, 확인
    sessionListUpdateUserPacketId(obj, id) {
        this.connections[obj.id].packetId = id;
    }
    getUserPacketIdAtSessionList(obj) {
        return this.connections[obj.id].packetId;
    }
    // 세션리스트에 유저 패킷상태 변경, 확인
    sessionListUpdateUserPacketStatus(obj, packetStatus) {
        this.connections[obj.id].packetStatus = packetStatus;
    }
    getUserPacketStatusAtSessionList(obj) {
        return this.connections[obj.id].packetStatus;
    }
    // 세션리스트에서 유저 네임 변경, 확인
    sessionListUpdateUserName(obj, userName) {
        this.connections[obj.id].userName = userName;
    }
    getUserNameAtSessionList(obj) {
        return this.connections[obj.id].userName;
    }
    // 세션리스트에서 유저 아이디 변경, 확인
    sessionListUpdateUserId(obj, userId) {
        this.connections[obj.id].userId = userId;
    }
    getUserIdAtSessionList(obj) {
        return this.connections[obj.id].userId;
    }
    // 세션리스트에서 게임이름 변경, 확인
    sessionListUpdateGameName(obj, gameName) {
        this.connections[obj.id].gameName = gameName;
    }
    getGameNameAtSessionList(obj) {
        return this.connections[obj.id].gameName;
    }
    // 세션리스트에서 게임아이디 변경, 확인
    sessionListUpdateGameId(obj, gameId) {
        this.connections[obj.id].gameId = gameId;
    }
    getGameIdAtSessionList(obj) {
        return this.connections[obj.id].gameId;
    }
    // 세션리스트에서 유저 FreeGame 패킷 QUEUE 리스트 초기화
    sessionListFreeGamePacketListInit(obj) {
        this.connections[obj.id].freeGameList = [];
    }
    // 세션리스트에서 유저 FreeGame 패킷 QUEUE 리스트 PUSH
    sessionListFreeGamePacketListPush(obj, freeGamePacket) {
        this.connections[obj.id].freeGameList = freeGamePacket;
    }
    // 유저 FreeGame 패킷 QUEUE 리스트에서 FreeGame POP SEND
    sessionListFreeGamePacketListPop(obj) {
        return this.connections[obj.id].freeGameList.shift();
    }
    // 유저 freeGamebetMultiplier 변경, 확인
    sessionListFreeGameMultiplier(obj, freeGamebetMultiplier) {
        this.connections[obj.id].freeGamebetMultiplier = freeGamebetMultiplier;
    }
    getFreeGameMultiplierAtSessionList(obj) {
        return this.connections[obj.id].freeGamebetMultiplier;
    }
    // 세션리스트에서 게임토큰 변경, 확인
    sessionListUpdateGameToken(obj, gameToken) {
        this.connections[obj.id].gameToken = gameToken;
    }
    getGameTokenAtSessionList(obj) {
        return this.connections[obj.id].gameToken;
    }
    // 세션리스트에서 currentPaylines 설정, 확인
    sessionListUpdateCurrentPaylines(obj, currentPaylines) {
        this.connections[obj.id].currentPaylines = currentPaylines;
    }
    getCurrentPaylinesAtSessionList(obj) {
        return this.connections[obj.id].currentPaylines;
    }
    // 세션리스트에서 reelDB 설정, 확인
    sessionListUpdateReelDB(obj, reelDB) {
        this.connections[obj.id].reelDB = reelDB;
    }
    getReelDBAtSessionList(obj) {
        return this.connections[obj.id].reelDB;
    }
    // ====================================================


    // ====================================================
    // DB 처리 부분
    // 게임아이디, 게임토큰으로 유저정보()
    authGameAndUser(obj, con, gameId, gameToken) {
        var _result = {};
        {
            // 게임정보 설정
            var _sql = 'CALL GetGameInfoByGameId(?)';
            var _para = gameId;
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    // 에러 패킷 전송
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

                    // 게임 아이디 설정
                    this.sessionListUpdateGameId(obj, _result.gameId);
                    // 게임 ReelDB 설정
                    this.sessionListUpdateReelDB(obj, _result.reelDB);
                    // 게임 이름 설정
                    this.sessionListUpdateGameName(obj, _result.gameName);
                    // Paylines 설정
                    this.sessionListUpdateCurrentPaylines(obj, _result.currentPaylines);
                    {
                        // 유저 확인
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
                                // 유저 토큰 설정
                                this.sessionListUpdateGameToken(obj, gameToken);
                                // 유저 이름 설정
                                this.sessionListUpdateUserName(obj, _result.userName);
                                // 게임 및 유저 등록 결과 패킷 전송
                                this.sendUserInfo(obj, _result);
                                // GameRegister 로 변경
                                this.sessionListUpdateUserPacketStatus(obj, 'GameRegister');
                            }
                        });
                    }
                }
            });
        }
    }

    // 최초 게임 INIT 패킷 확인(잔액포함)
    getGameInitPacket(obj, con, reelDB, gameToken) {
        var _result = {};
        {
            // init 패킷 확인
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
                        // 유저 잔액 확인
                        var _sql = 'CALL GetUserBalanceByGameToken(?)';
                        var _para = gameToken;
                        con.query(_sql, _para, (error, results, fields) => {
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

    // GameRTP 가져오기
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
                    // RTP 확인
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
                            } catch (error) {
                                _result.code = 19;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                                return;
                            }
                            if (_result.nowRTP <= _result.fixRTP || _result.nowRTP == 0) {
                                if (Math.random() > 0.01) {
                                    this.getGambleOrTakePacket(obj, pool, reelDB, gameId, gameToken, betMultiplier, 0);
                                } else {
                                    this.getFreeGameIntroPacket(obj, pool, reelDB, gameId, gameToken, betMultiplier, 0);
                                }
                            } else {
                                this.getGameIdlePacket(obj, pool, reelDB, gameId, gameToken, betMultiplier);
                            }
                        }
                    });
                }
            });
        }
    }

    // GameIdle 패킷 선택 및 유저 잔액정리, 유저정보, 배팅내역 정리
    getGameIdlePacket(obj, con, reelDB, gameId, gameToken, betMultiplier) {
        var _result = {};
        {
            // GameIdle 패킷 확인
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
                        con.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 22;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // GameIdle 패킷 조립에 필요한 변수
                                    // 패킷아이디, balance, roundId, currentBetMultiplier
                                    _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                    _result.balance = _data[0].balance;
                                    _result.roundId = _data[0].roundId;
                                    _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                    this.sendGameIdlePacket(obj, _result);
                                    this.sessionListUpdateUserPacketStatus(obj, 'GameIdle');
                                } else {
                                    _result.code = 23;
                                    _result.message = 'SetUserBetGameIdleProcess';
                                    this.sendErrorPacket(obj, _result);
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    // GambleOrTake 패킷 선택 및 유저 잔액 확인 SEND
    getGambleOrTakePacket(obj, con, reelDB, gameId, gameToken, betMultiplier, baseGameWin) {
        var _result = {};
        {
            // GambleOrTake 패킷 확인
            var _sql = 'CALL ' + reelDB + '.SelectRunGambleOrTake(?)';
            var _para = baseGameWin; // 1배수 당첨금
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
                        con.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 25;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // GamebleOrTake 패킷 조합
                                    // 패킷아이디, currentBetMultiplier, totalWager, totalBaseGameWin, baseGameWin, totalWin, balance, roundId
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

    // FreeGameIntro 패킷 선택 및 유저 잔액 확인 SEND
    getFreeGameIntroPacket(obj, con, reelDB, gameId, gameToken, betMultiplier, totalWin) {
        var _result = {};
        {
            // FreeGameIntro 패킷 확인
            var _sql = 'CALL ' + reelDB + '.SelectRunFreeGame(?)';
            var _para = totalWin; // 프리게임 전체 금액 (1배수)
            con.query(_sql, _para, (error, results, fields) => {
                if (error || results[0].length == 0) {
                    _result.code = 27;
                    _result.message = error;
                    this.sendErrorPacket(obj, _result);
                } else {
                    this.sessionListFreeGamePacketListInit(obj);
                    this.sessionListFreeGameMultiplier(obj, betMultiplier); // 프리게임용 betMultiplier 설정
                    this.sessionListFreeGamePacketListPush(obj, results[0]);
                    var _data = this.sessionListFreeGamePacketListPop(obj);
                    _result.freeGameIntroNo = _data.FreeGameNo;
                    _result.freeGameIntro = _data.FreeGame;
                    _result.baseGameWin = _data.baseGameWin; // 프리게임 인트로는 baseGameWin 금액으로 처리(1배수)
                    _result.state = _data.state;
                    if (_result.state == 'FreeGameIntro') {
                        // SetUserBetFreeGameIntroProcess
                        var _sql = 'CALL SetUserBetFreeGameIntroProcess(?, ?, ?, ?, ?)';
                        var _para = [gameToken, gameId, _result.freeGameIntroNo, betMultiplier, _result.baseGameWin];
                        con.query(_sql, _para, (error, results, fields) => {
                            if (error || results[0].length == 0) {
                                _result.code = 28;
                                _result.message = error;
                                this.sendErrorPacket(obj, _result);
                            } else {
                                var _data = results[0];
                                if (_data[0].status == 'ok') {
                                    // FreeGameIntro 패킷 조립에 필요한 변수
                                    // 패킷아이디, currentBetMultiplier, totalWager, baseGameWin, balance, roundId,
                                    _result.packetId = this.getUserPacketIdAtSessionList(obj);
                                    _result.currentBetMultiplier = _data[0].currentBetMultiplier;
                                    _result.totalWager = _data[0].totalWager;
                                    _result.baseGameWin = _data[0].baseGameWin;
                                    // 프리게임에서는 total 관련 금액은 기존 패킷에서 betMultiplier 곱하기로 처리
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

    // FreeGameStart 패킷 선택 및 유저 잔액 확인 SEND
    getFreeGameStartPacket(obj, con, /*reelDB, gameId,*/ gameToken/*, betMultiplier , totalWin*/) {
        var _result = {};

        var _sql = 'CALL GameTokenAuth(?)';
        var _para = gameToken;
        con.query(_sql, _para, (error, results, fields) => {
            if (error || results[0].length == 0 || (results[0])[0].status == 'error') {
                _result.code = 31;
                _result.message = 'GameTokenAuth';
                this.sendErrorPacket(obj, _result);
            } else {
                var _data = this.sessionListFreeGamePacketListPop(obj);
                _result.freeGameStartNo = _data.FreeGameNo;
                _result.freeGameStart = _data.FreeGame;
                _result.state = _data.state;
                // 필요하지 않을것 같지만 일단 정리해 보자.
                // _result.totalWin = _data.totalWin;
                if (!_result.freeGameStart || _result.state != 'FreeGame') {
                    _result.code = 32;
                    _result.message = 'getFreeGameStartPacket';
                    this.sendErrorPacket(obj, _result);
                } else {
                    // 유저 잔액 확인
                    var _sql = 'CALL GetUserBalanceByGameToken(?)';
                    var _para = gameToken;
                    con.query(_sql, _para, (error, results, fields) => {
                        if (error || results[0].length == 0) {
                            _result.code = 33;
                            _result.message = error;
                            this.sendErrorPacket(obj, _result);
                        } else {
                            var _data = results[0];
                            _result.status = 'ok';
                            // FreeGameStart 패킷 조립에 필요한 변수
                            // 패킷아이디, currentBetMultiplier, balance
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
                    _result.error = 'sessionListFreeGamePacketListPop';
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
                                // FreeGame 패킷 조립에 필요한 변수
                                // 패킷아이디, currentBetMultiplier, balance, roundId 외 나머지는 패킷을 전송하면서 처리한다.
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
                    // 유저 잔액 확인
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
                            // FreeGameOutroEnd 패킷 조립에 필요한 변수
                            // 패킷아이디, balance, roundId,
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

    // 선택게임 URL 전송
    sendGameUrl() {

    }

    // 에러 패킷 보내기 //{"id":1,"error":{"code":*미정,"message":"유저 미확인, 게임 미확인(향후 바뀔수 있음)"}}
    sendErrorPacket(obj, data) {
        var _sendData = {};
        _sendData.id = this.getUserPacketIdAtSessionList(obj);
        _sendData.error = {};
        _sendData.error.code = data.code;
        _sendData.error.message = data.message;
        obj.send(JSON.stringify(_sendData));
        console.log(JSON.stringify(_sendData));
    }

    // {"id":1,"result":{"user":"유저이름","currency":"FUN","language":"en-US"}} SEND
    sendUserInfo(obj, data) {
        var _sendData = {};
        _sendData.id = this.getUserPacketIdAtSessionList(obj);
        _sendData.result = {};
        _sendData.result.user = data.userName;
        _sendData.result.user = 'demo';
        _sendData.result.currency = 'FUN';
        _sendData.result.language = 'en-US';
        obj.send(JSON.stringify(_sendData));
    }

    // 최초 게임 INIT 패킷 확인(잔액포함) 전송
    sendGameInitPacket(obj, data) {
        var _sendData = JSON.parse(data.gameIdle);
        _sendData.id = this.getUserPacketIdAtSessionList(obj);
        _sendData.result.balance = data.balance;
        obj.send(JSON.stringify(_sendData));
    }

    // GameIdle 패킷 SEND
    sendGameIdlePacket(obj, data) {
        var _sendData = JSON.parse(data.gameIdle);
        _sendData.id = data.packetId;
        _sendData.result.balance = data.balance;
        _sendData.result.currentBetMultiplier = data.currentBetMultiplier;
        _sendData.result.roundId = data.roundId;
        obj.send(JSON.stringify(_sendData));
    }

    // GambleOrTake 패킷 SEND
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
        obj.send(JSON.stringify(_sendData));
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
        obj.send(JSON.stringify(_sendData));
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
        // _sendData.result.roundId = data.roundId;
        obj.send(JSON.stringify(_sendData));
    }

    sendFreeGamePacket(obj, data) {
        // FreeGame 패킷 조립에 필요한 변수
        // 패킷아이디, currentBetMultiplier, balance, roundId 외 나머지는 패킷을 전송하면서 처리한다.
        var _sendData = JSON.parse(data.freeGame);

        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier   = data.currentBetMultiplier;
        _sendData.result.totalWager             = _sendData.result.totalWager * data.currentBetMultiplier;
        _sendData.result.totalBaseGameWin       = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.totalFreeGameWin       = _sendData.result.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.baseGame.baseGameWin       = _sendData.result.baseGame.baseGameWin * data.currentBetMultiplier;

        _sendData.result.freeGame.freeGameWin       = _sendData.result.freeGame.freeGameWin * data.currentBetMultiplier;
        _sendData.result.freeGame.totalFreeGameWin  = _sendData.result.freeGame.totalFreeGameWin * data.currentBetMultiplier;

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
        obj.send(JSON.stringify(_sendData));
    }

    sendFreeGameOutroEndPacket(obj, data) {
        // FreeGameOutroEnd 패킷 조립에 필요한 변수
        // 패킷아이디, currentBetMultiplier, balance 외 나머지는 패킷을 전송하면서 처리한다.
        var _sendData = JSON.parse(data.freeGame);

        _sendData.id = data.packetId;
        _sendData.result.currentBetMultiplier   = data.currentBetMultiplier;
        _sendData.result.totalWager             = _sendData.result.totalWager * data.currentBetMultiplier;
        _sendData.result.totalBaseGameWin       = _sendData.result.totalBaseGameWin * data.currentBetMultiplier;
        _sendData.result.totalFreeGameWin       = _sendData.result.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.baseGame.baseGameWin       = _sendData.result.baseGame.baseGameWin * data.currentBetMultiplier;

        _sendData.result.freeGame.freeGameWin       = _sendData.result.freeGame.freeGameWin * data.currentBetMultiplier;
        _sendData.result.freeGame.totalFreeGameWin  = _sendData.result.freeGame.totalFreeGameWin * data.currentBetMultiplier;

        _sendData.result.totalWin = _sendData.result.totalWin * data.currentBetMultiplier;

        _sendData.result.balance = data.balance;
        obj.send(JSON.stringify(_sendData));
    }

    // * 유저 정보, 배팅내역 정리 SEND
    setUserInfoAndBetList(obj) {

    }
}

module.exports = TGameServer;