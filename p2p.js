const WebSocket = require('ws');

const messageTypes = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

class P2PServer {
    constructor(sockets, p2pPort, blockchain) {
        this.sockets = sockets;
        this.p2pPort = p2pPort;
        this.blockchain = blockchain;
    }

    initServer() {
        this.server = new WebSocket.Server({port: this.p2pPort});
        this.server.on('connection', ws => this.initConnection(ws));
        console.log('Listening websocket p2p port on: ' + this.p2pPort);

    }

    initConnection(ws) {
        this.sockets.push(ws);
        this.initMessageHandler(ws);
        this.initErrorHandler(ws);
        this.write(ws, P2PServer.queryChainLengthMsg());
    }

    closeConnection() {
        this.server.close();
    }

    initMessageHandler(ws) {
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            console.log('Received message: ' + JSON.stringify(message));
            switch (message.type) {
                case messageTypes.QUERY_LATEST:
                    this.write(ws, this.responseLatestMsg());
                    break;
                case messageTypes.QUERY_ALL:
                    this.write(ws, this.responseChainMsg());
                    break;
                case messageTypes.RESPONSE_BLOCKCHAIN:
                    this.handleBlockchainResponse(message);
                    break;
            }
        });
    }

    initErrorHandler(ws) {
        const closeConnection = (ws) => {
            console.log('connection failed to peer: ' + ws.url);
            this.sockets.splice(this.sockets.indexOf(ws), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    }

    handleBlockchainResponse(message) {
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

    connectToPeers(newPeers) {
        newPeers.forEach((peer) => {
            const ws = new WebSocket(peer);
            ws.on('open', () => this.initConnection(ws));
            ws.on('error', () => {
                console.log('connection failed')
            });
        });
    }

    static queryChainLengthMsg() {
        return {'type': messageTypes.QUERY_LATEST};
    }

    static queryAllMsg() {
        return {'type': messageTypes.QUERY_ALL};
    }

    responseChainMsg() {
        return {
            'type': messageTypes.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(this.blockchain.chain)
        };
    }

    responseLatestMsg() {
        return {
            'type': messageTypes.RESPONSE_BLOCKCHAIN,
            'data': JSON.stringify([this.blockchain.getLatestBlock()])
        }
    }

    write(ws, message) {
        ws.send(JSON.stringify(message));
    }

    broadcast(message) {
        this.sockets.forEach(socket => this.write(socket, message));
    }
}

exports.P2PServer = P2PServer;
