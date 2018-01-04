const express = require('express');
const bodyParser = require('body-parser');

class HttpServer {
    constructor(sockets, httpPort, p2pServer, blockchain) {
        this.sockets = sockets;
        this.httpPort = httpPort;
        this.p2pServer = p2pServer;
        this.blockchain = blockchain;
        this.app = express();
    }

    initServer() {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(express.static('www'));

        this.app.get('/blocks', (req, res) => res.send(JSON.stringify(this.blockchain)));

        this.app.post('/mineBlock', (req, res) => {
            const newBlock = this.blockchain.generateNextBlock(req.body.data);
            this.blockchain.addBlock(newBlock);
            this.p2pServer.broadcast(this.p2pServer.responseLatestMsg());
            console.log('Block added: ' + JSON.stringify(newBlock));
            res.send();
        });

        this.app.get('/peers', (req, res) => {
            res.send(this.sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });

        this.app.post('/addPeer', (req, res) => {
            this.p2pServer.connectToPeers([req.body.peer]);
            res.send();
        });

        this.app.get('/websocketPort', (req, res) => res.send(JSON.stringify({"port": this.p2pServer.p2pPort})));

        this.server = this.app.listen(this.httpPort, () => {
            console.log('Listening http on port: ' + this.httpPort)
        });
    }

    closeServer() {
        this.server.close();
    }
}

exports.HttpServer = HttpServer;
