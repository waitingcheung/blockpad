const request = require('supertest');
const chai = require('chai');

const expect = chai.expect;
const chaiMatchPattern = require('chai-match-pattern');
const assertArrays = require('chai-arrays');

const _ = chaiMatchPattern.getLodashModule();

chai.use(chaiMatchPattern);
chai.use(assertArrays);

const Block = require('../block').Block;
const Blockchain = require('../blockchain').Blockchain;
const P2PServer = require('../p2p').P2PServer;
const HTTPServer = require('../http').HttpServer;

const httpPort = process.env.HTTP_PORT || 3001;
const p2pPort = process.env.P2P_PORT || 6001;

let sockets, blockchain, p2pServer, httpServer, app;

describe('HTTP', function () {
    before(function () {
        sockets = [];
        blockchain = new Blockchain();

        p2pServer = new P2PServer(sockets, p2pPort, blockchain);
        httpServer = new HTTPServer(sockets, httpPort, p2pServer, blockchain);

        p2pServer.initServer();
        httpServer.initServer();

        app = httpServer.app
    });

    after(function () {
        httpServer.closeServer();
        p2pServer.closeConnection();
    });

    describe('GET /blocks', function () {
        it('Respond with JSON string of a block', function (done) {
            request(app)
                .get('/blocks')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(JSON.parse(res.text).chain).to.be.array();
                    expect(JSON.parse(res.text).chain[0]).to.matchPattern({
                        index: _.isNumber,
                        timestamp: _.isNumber,
                        data: _.isString,
                        previousHash: _.isString,
                        hash: _.isString,
                        nonce: _.isNumber
                    });
                    done();
                });
        });
    });

    describe('POST /mineBlocks', function () {
        it('Add a new block from local', function (done) {
            request(app)
                .post('/mineBlock')
                .send({
                    "data": JSON.stringify({
                        "content": "<div>1</div>",
                        "delta": undefined
                    })
                })
                .expect(200, done);
        });

        it('Add another new block from local', function (done) {
            request(app)
                .post('/mineBlock')
                .send({
                    "data": JSON.stringify({
                        "content": "<div>2</div>",
                        "delta": undefined
                    })
                })
                .expect(200, done);
        });
    });

    describe('Peers', function () {
        const peerSockets = [];
        const peerBlockchain = new Blockchain();

        const peerP2pServer = new P2PServer(peerSockets, 6002, peerBlockchain);
        const peerHttpServer = new HTTPServer(peerSockets, 3002, peerP2pServer, peerBlockchain);

        peerP2pServer.initServer();
        peerHttpServer.initServer();

        describe('POST and GET peers', function () {
            it('Add a new peer', function (done) {
                request(peerHttpServer.app)
                    .post('/addPeer')
                    .send({"peer": "ws://localhost:6001"})
                    .expect(200, done);
            });
        });

        describe('POST /mineBlocks', function () {
            it('Add a new block from the peer', function (done) {
                request(peerHttpServer.app)
                    .post('/mineBlock')
                    .send({
                        "data": JSON.stringify({
                            "content": "<div>3</div>",
                            "delta": undefined
                        })
                    })
                    .expect(200, done);
            });

            it('Add a new block from local', function (done) {
                request(app)
                    .post('/mineBlock')
                    .send({
                        "data": JSON.stringify({
                            "content": "<div>4</div>",
                            "delta": undefined
                        })
                    })
                    .expect(200, done);
            });
        });

        peerHttpServer.closeServer();
        peerP2pServer.closeConnection();
    });

    describe('GET /websocketPort', function () {
        it('Respond with JSON string with a port number', function (done) {
            request(app)
                .get('/websocketPort')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(JSON.parse(res.text)).to.matchPattern({port: _.isNumber});
                    done();
                });
        });
    });

    describe('Invalid new chain', function () {
        it('Reject a new block with invalid index', function (done) {
            const blockchain = new Blockchain();
            blockchain.addBlock(new Block(0, 0, '', '', ''));
            expect(blockchain.chain.length).to.equal(1);
            done();
        });

        it('Reject a new block with invalid previous hash', function (done) {
            const blockchain = new Blockchain();
            blockchain.addBlock(new Block(1, 0, '', '', ''));
            expect(blockchain.chain.length).to.equal(1);
            done();
        });

        it('Reject a new block with invalid index', function (done) {
            const blockchain = new Blockchain();
            blockchain.addBlock(new Block(0, 0, '', '', ''));
            expect(blockchain.chain.length).to.equal(1);
            done();
        });

        it('Reject a new block with invalid hash', function (done) {
            const blockchain = new Blockchain();
            const newBlock = blockchain.generateNextBlock('data');
            newBlock.hash = '0';
            blockchain.addBlock(newBlock);
            expect(blockchain.chain.length).to.equal(1);
            done();
        });

        it('Reject an empty chain', function (done) {
            const blockchain = new Blockchain();
            blockchain.replaceChain([]);
            expect(blockchain.chain.length).to.equal(1);
            done();
        });

        it('Reject a chain with invalid genesis block', function (done) {
            const invalidChain = new Blockchain();
            invalidChain.chain[0].index = -1;

            const blockchain = new Blockchain();
            blockchain.addBlock(blockchain.generateNextBlock('data'));
            blockchain.replaceChain(invalidChain.chain);
            expect(blockchain.chain.length).to.equal(2);
            done();
        });

        it('Reject a chain with the latest block being invalid', function (done) {
            const invalidChain = new Blockchain();
            invalidChain.addBlock(invalidChain.generateNextBlock('data'));
            invalidChain.chain[1].index = -1;
            const blockchain = new Blockchain();
            blockchain.replaceChain(invalidChain.chain);
            expect(blockchain.chain.length).to.equal(1);
            done();
        });
    });
});
