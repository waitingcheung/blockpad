const Math = require('./math');

class Block {
    constructor(index, timestamp, data, previousHash, hash) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash.toString();
        this.hash = hash.toString();
        this.nonce = 0;
    }

    mineBlock(difficulty) {
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
            this.nonce++;
            this.hash = Math.calculateHashForBlock(this);
        }

        console.log('BLOCK MINED: ' + this.hash);
    }
}

exports.Block = Block;
