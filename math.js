const SHA256 = require('crypto-js/sha256');

function calculateHash(index, timestamp, data, previousHash, nonce) {
    return SHA256([
        index,
        timestamp,
        JSON.stringify(data),
        previousHash,
        nonce
    ].join('')).toString();
}

function calculateHashForBlock(block) {
    return calculateHash(block.index, block.timestamp, block.data, block.previousHash, block.nonce);
}

module.exports = {
    calculateHash: calculateHash,
    calculateHashForBlock: calculateHashForBlock
};
