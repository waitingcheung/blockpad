const Blockchain = require('./blockchain').Blockchain;
const P2PServer = require('./p2p').P2PServer;
const HTTPServer = require('./http').HttpServer;

const httpPort = process.env.HTTP_PORT || 3001;
const p2pPort = process.env.P2P_PORT || 6001;
const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const sockets = [];
const blockchain = new Blockchain();

const p2pServer = new P2PServer(sockets, p2pPort, blockchain);
const httpServer = new HTTPServer(sockets, httpPort, p2pServer, blockchain);

p2pServer.initServer();
p2pServer.connectToPeers(initialPeers);
httpServer.initServer();
