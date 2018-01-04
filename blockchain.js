const Block = require('./block').Block;
const Math = require('./math');

class Blockchain {
    constructor() {
        this.chain = [this.getGenesisBlock()];
        this.difficulty = 2;
    }

    getGenesisBlock() {
        return new Block(0, 737510400, 'Genesis block', '0', '9397591240bc3a17c0f737e72837953459df4ee23ff0ccd089af18ecaa05b991');
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        if (this.isValidNewBlock(newBlock, this.getLatestBlock())) {
            newBlock.mineBlock(this.difficulty);
            this.chain.push(newBlock);
        }
    }

    generateNextBlock(blockData) {
        const previousBlock = this.getLatestBlock();
        const timestamp = new Date().getTime();
        const nextIndex = previousBlock.index + 1;
        const previousHash = previousBlock.hash;
        const nextHash = Math.calculateHash(nextIndex, timestamp, blockData, previousHash, 0);
        return new Block(nextIndex, timestamp, blockData, previousHash, nextHash);
    }

    replaceChain(newBlocks) {
        if (this.isValidChain(newBlocks) && newBlocks.length > this.chain.length) {
            console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
            this.chain = newBlocks;
        } else {
            console.log('Received blockchain invalid');
        }
    }

    isValidNewBlock(newBlock, previousBlock) {
        if (previousBlock.index + 1 !== newBlock.index) {
            console.log('Invalid index');
            return false;
        } else if (previousBlock.hash !== newBlock.previousHash) {
            console.log('Invalid previous hash');
            return false;
        } else if (Math.calculateHashForBlock(newBlock) !== newBlock.hash) {
            console.log('Invalid hash: ' + Math.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
            return false;
        }
        return true;
    }

    isValidChain(targetChain) {
        if (!Array.isArray(targetChain) || targetChain.length === 0) return false;

        let prevBlock = targetChain[0];
        if (JSON.stringify(prevBlock) !== JSON.stringify(this.getGenesisBlock())) {
            return false;
        }

        for (let i = 1; i < targetChain.length; i++) {
            if (this.isValidNewBlock(targetChain[i], prevBlock)) {
                prevBlock = targetChain[i];
            } else {
                return false;
            }
        }

        return true;
    }
}

exports.Blockchain = Blockchain;
