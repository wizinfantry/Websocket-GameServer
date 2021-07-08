class TFakeMoney {
    constructor() {
        this._minBet = 0.5;
        this._fakeMoneyObject = {};
        this.initWinCountList(this._fakeMoneyObject);
        this.initWinMoneyList(this._fakeMoneyObject);
        this.initLostCount(this._fakeMoneyObject);
    }

    destroy() {
        this._fakeMoneyObject.winCountList = undefined;
        this._fakeMoneyObject.winMoneyList = undefined;
        this._fakeMoneyObject.loseCount = undefined;
    }

    initWinCountList(fakeMoneyObject) {
        fakeMoneyObject.winCountList = null;
        fakeMoneyObject.winCountList = this.getShuffleWinCountList();;
    }

    initWinMoneyList(fakeMoneyObject) {
        fakeMoneyObject.winMoneyList = null;
        fakeMoneyObject.winMoneyList = this.getShuffleWinMoneyList();
    }

    getShuffleWinCountList() {
        // 당첨구간리스트 셔플
        // 1,2,3,4,5
        var _array = [0, 5, 0, 1, 2, 3, 4];
        return _array.map((a) => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map((a) => a[1]);
    }

    getWinCount() {
        return this._fakeMoneyObject.winCountList[0];
    }
    setWinCount() {
        this._fakeMoneyObject.winCountList.shift();
        if (this._fakeMoneyObject.winCountList.length == 0) {
            this.initWinCountList(this._fakeMoneyObject);
        }
    }

    getShuffleWinMoneyList() {
        // 당첨금배율 셔플
        // 0.1, 0.2, 0.3, 0.4, 0.5
        var _array = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, -0.1, -0.2, -0.3, -0.4, -0.5];
        return _array.map((a) => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map((a) => a[1]);
    }

    getWinMoney(wager, minBet) {
        // 당첨금액확인
        console.log('getWinMoney wager, minBet', wager, minBet);
        var _rate = this._fakeMoneyObject.winMoneyList.shift();
        var _multi = parseFloat(wager / minBet);
        //var _winMoney = parseFloat(wager + (wager * _rate)) * 100;
        var _winMoney = parseFloat(wager + (wager * _rate)) * 1;
        _winMoney = parseInt(_winMoney / _multi);
        if (this._fakeMoneyObject.winMoneyList.length == 0) {
            this.initWinMoneyList(this._fakeMoneyObject);
        }
        console.log('getWinMoney _winMoney', _winMoney);
        return _winMoney;
    }

    initLostCount(fakeMoneyObject) {
        fakeMoneyObject.loseCount = 0;
    }

    getLoseCount() {
        return this._fakeMoneyObject.loseCount;
    }
    addLoseCount() {
        this._fakeMoneyObject.loseCount++;
    }
    setLoseCount(count) {
        this._fakeMoneyObject.loseCount = count;
    }

    getWinResult() {
        // 게임결과확인
        var _loseCount = this.getLoseCount();
        var _winCount = this.getWinCount();
        console.log('getWinResult _loseCount', _loseCount);
        console.log('getWinResult _winCount', _winCount);
        this.addLoseCount();
        if (_loseCount >= _winCount) {
            this.setWinCount();
            this.setLoseCount(0);
            return true;
        } else {
            return false;
        }
    }
}

module.exports = TFakeMoney;