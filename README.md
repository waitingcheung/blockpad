# BlockPad

[![Build Status](https://travis-ci.org/waitingcheung/blockpad.svg?branch=master)](https://travis-ci.org/waitingcheung/blockpad)
[![codecov](https://codecov.io/gh/waitingcheung/blockpad/branch/master/graph/badge.svg)](https://codecov.io/gh/waitingcheung/blockpad)

BlockPad is a real-time collaborative rich text editor powered by a blockchain.

![](https://user-images.githubusercontent.com/2617118/34530035-d5ee0ef6-f0e8-11e7-979d-ed7fac8b9ff4.gif)

## Installation
```sh
npm install
```

## Usage
1. Launch two instances of BlockPad with different HTTP and P2P ports. Specify the WebSocket URL for the peers.
```sh
HTTP_PORT=3001 P2P_PORT=6001 npm start
HTTP_PORT=3002 P2P_PORT=6002 PEERS=ws://localhost:6001 npm start
```

2. Go to http://localhost:3001 and http://localhost:3002 in your browser and start typing.

## Development

This system consists of the following components:

- A blockchain: the data structure that stores the content of the text editor.
- A peer-to-peer (P2P) server: the server that updates the blockchain between peers.
- An HTTP server: the server that provides the APIs for accessing the blockchain and the peers.
- A text editor: the web interface for text editing.

### Blockchain

A [block](block.js) is the basic element of a blockchain and a [blockchain](blockchain.js) is an array of blocks. A block consists of the following fields: ``index``, ``timestamp``, ``data``, ``previousHash``, and ``hash``.
```js
class Block {
    constructor(index, timestamp, data, previousHash, hash) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash.toString();
        this.hash = hash.toString();
    }
}
```

The first block is called the genesis block and its fields are hardcoded.
```js
function getGenesisBlock() {
    return new Block(0, 737510400, 'Genesis block', '0', '9397591240bc3a17c0f737e72837953459df4ee23ff0ccd089af18ecaa05b991');
}
```

The fields of each new block are computed from the previous block.
```js
function generateNextBlock(blockData) {
    const previousBlock = this.getLatestBlock();
    const timestamp = new Date().getTime();
    const nextIndex = previousBlock.index + 1;
    const previousHash = previousBlock.hash;
    const nextHash = Math.calculateHash(nextIndex, timestamp, blockData, previousHash, 0);
    return new Block(nextIndex, timestamp, blockData, previousHash, nextHash);
}
```

A block is valid if its ``index``, ``previousHash``, and ``hash`` are valid. A blockchain is valid if every of its block is valid.
```js
function isValidNewBlock(newBlock, previousBlock) {
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

function isValidChain(targetChain) {
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
```

The block also implements [proof-of-work](https://en.bitcoin.it/wiki/Proof_of_work), which enforces the hash values to start with a certain number of zeroes.
```js
function mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
        this.nonce++;
        this.hash = Math.calculateHashForBlock(this);
    }
    console.log('BLOCK MINED: ' + this.hash);
}
```

### P2P Server

The [p2p server](p2p.js) setups connections with the peers.
```js
const WebSocket = require('ws');

function initServer() {
    this.server = new WebSocket.Server({port: this.p2pPort});
    this.server.on('connection', ws => this.initConnection(ws));
    console.log('Listening websocket p2p port on: ' + this.p2pPort);
}

function initConnection(ws) {
    this.sockets.push(ws);
    this.initMessageHandler(ws);
    this.initErrorHandler(ws);
    this.write(ws, P2PServer.queryChainLengthMsg());
}

function connectToPeers(newPeers) {
    newPeers.forEach((peer) => {
        const ws = new WebSocket(peer);
        ws.on('open', () => this.initConnection(ws));
        ws.on('error', () => {
            console.log('connection failed')
        });
    });
}

initServer();
connectToPeers(initialPeers);
```

It also updates the blockchain when the index of the latest received block is larger than the index of the latest block held. Either of the following can occur:

- The latest received block is the successor of the latest block. We can safely add the received block to the chain.
- The received blockchain have a length of 1. We have to query the chain from the peer.
- The received blockchain is longer than the current chain. We replace the current chain with the received one.

```js
function handleBlockchainResponse(message) {
    const receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index));
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = this.blockchain.getLatestBlock();

    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            console.log("We can append the received block to our chain");
            this.blockchain.chain.push(latestBlockReceived);
            this.broadcast(this.responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            console.log("We have to query the chain from our peer");
            this.broadcast(P2PServer.queryAllMsg());
        } else {
            console.log("Received blockchain is longer than current blockchain");
            this.blockchain.replaceChain(receivedBlocks);
        }
    } else {
        console.log('Received blockchain is not longer than current blockchain. Do nothing');
    }
}
```

### HTTP Server

The [HTTP server](http.js) provides the RESTful APIs to the web interface to access the blockchain and the peers.

```js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('www'));

app.get('/blocks', (req, res) => res.send(JSON.stringify(this.blockchain)));
app.post('/mineBlock', (req, res) => {
    const newBlock = this.blockchain.generateNextBlock(req.body.data);
    this.blockchain.addBlock(newBlock);
    this.p2pServer.broadcast(this.p2pServer.responseLatestMsg());
    console.log('Block added: ' + JSON.stringify(newBlock));
    res.send();
});
```

### Text Editor

The [text editor](www/index.html) uses [Quill](https://quilljs.com) as the underlying editor.
```html
<link href="https://cdn.quilljs.com/1.3.4/quill.snow.css" rel="stylesheet">
<div id="editor"></div>
<script src="https://cdn.quilljs.com/1.3.4/quill.js"></script>
<script>
  var quill = new Quill('#editor', {
    theme: 'snow'
  });
</script>
```

The text editor has the following functions.

- Get the Latest Content: when the document is ready, get the latest content of the editor from the HTTP server.
```js
$.getJSON('blocks', function (data) {
    if (data.chain.length > 1) {
        var latestBlock = data.chain[data.chain.length - 1];
        var content = JSON.parse(latestBlock.data).content;
        $('.ql-editor').html(content);
    }
});
```
- Listen for Text Changes: when a peer updates the content of the text editor, reflect the changes on the editor.
```js
var ws = new WebSocket('ws://localhost:6001');
ws.onmessage = function (event) {
    var message = JSON.parse(event.data);
    var receivedBlock = JSON.parse(message.data.substring(1, message.data.length - 1));
    var blockData = JSON.parse(receivedBlock.data);
    var content = blockData.content;
    var range = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(content);
    quill.setSelection(range);
}
```

- Update Text Changes: when a text change event occurs at the editor, send the latest content to the editor.
```js
quill.on('text-change', function (delta, oldDelta, source) {
    if (source === 'user') {
        $.post('mineBlock', {
            "data": JSON.stringify(
                {
                    "content": $('.ql-editor').html(),
                    "delta": delta
                }
            )
        });
        console.log("A user action triggered this change.");
    }
});
```

## Testing
```sh
npm test
```

## References

- [Awesome Blockchains](https://github.com/openblockchains/awesome-blockchains)
- [A blockchain in 200 lines of code](https://medium.com/@lhartikk/a-blockchain-in-200-lines-of-code-963cc1cc0e54)
- Writing a tiny blockchain in JavaScript ([part 1](https://www.savjee.be/2017/07/Writing-tiny-blockchain-in-JavaScript/), [part 2](https://www.savjee.be/2017/09/Implementing-proof-of-work-javascript-blockchain/))
- [NodeJS blockchain implementation: BrewChain: Chain+WebSockets+HTTP Server](http://www.darrenbeck.co.uk/blockchain/nodejs/nodejscrypto/)
- [Build a collaborative rich text editor with Node.js and Socket.io](https://medium.com/front-end-hacking/build-a-collaborative-rich-text-editor-with-node-js-and-socket-io-38ee25b6e315)
