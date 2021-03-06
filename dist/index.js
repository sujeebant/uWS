"use strict";

Object.defineProperty(exports, "__esModule", {
    value: !0
});

var HTTP = require("http"), tls = require("tls");

class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(e, t) {
        if ("[object Function]" !== {}.toString.call(t)) return console.log("Listener should be a function");
        this.events[e] = t;
    }
    emit(e, ...t) {
        const r = this.events[e];
        r && r(...t);
    }
    removeEvents() {
        this.events = {};
    }
}

const native = require(`./uws_${process.platform}_${process.versions.modules}`), OPCODE_TEXT = 1, OPCODE_PING = 9, OPCODE_BINARY = 2, APP_PING_CODE = Buffer.from("9"), PERMESSAGE_DEFLATE = 1, SLIDING_DEFLATE_WINDOW = 16, DEFAULT_PAYLOAD_LIMIT = 16777216, noop = () => {};

native.setNoop(noop);

const clientGroup = native.client.group.create(0, DEFAULT_PAYLOAD_LIMIT);

native.client.group.onConnection(clientGroup, e => {
    const t = native.getUserData(e);
    t.external = e, t.emit("open");
}), native.client.group.onMessage(clientGroup, (e, t) => {
    t.emit("message", e);
}), native.client.group.onPing(clientGroup, (e, t) => {
    t.emit("ping", e);
}), native.client.group.onPong(clientGroup, (e, t) => {
    t.emit("pong", e);
}), native.client.group.onError(clientGroup, e => {
    process.nextTick(() => {
        e.emit("error", {
            message: "uWs client connection error",
            stack: "uWs client connection error"
        });
    });
}), native.client.group.onDisconnection(clientGroup, (e, t, r, s) => {
    s.external = null, process.nextTick(() => {
        s.emit("close", t, r), s = null;
    }), native.clearUserData(e);
});

class WebSocket extends EventEmitter {
    constructor(e, t, r) {
        super(), this.OPEN = 1, this.CLOSED = 0, this.external = noop, this.external = t, 
        this.executeOn = r ? "server" : "client", r || native.connect(clientGroup, e, this);
    }
    get _socket() {
        const e = this.external ? native.getAddress(this.external) : new Array(3);
        return {
            remotePort: e[0],
            remoteAddress: e[1],
            remoteFamily: e[2]
        };
    }
    get readyState() {
        return this.external ? this.OPEN : this.CLOSED;
    }
    on(e, t) {
        super.on(e, t);
    }
    ping(e) {
        this.external && native[this.executeOn].send(this.external, e, OPCODE_PING);
    }
    send(e, t, r) {
        if (!this.external) return r && r(new Error("Not opened"));
        const s = t && t.binary || "string" != typeof e ? OPCODE_BINARY : OPCODE_TEXT;
        native[this.executeOn].send(this.external, e, s, r ? () => process.nextTick(r) : null, t && t.compress);
    }
    terminate() {
        this.external && (native[this.executeOn].terminate(this.external), this.external = null);
    }
    close(e, t) {
        this.external && (native[this.executeOn].close(this.external, e, t), this.external = null);
    }
}

native.setNoop(noop);

class WebSocketServer extends EventEmitter {
    constructor(e, t) {
        super(), this.serverIsProvided = !1, this.lastUpgradeListener = !0, this.noDelay = !!e.noDelay, 
        e.path && "/" !== e.path[0] && (e.path = `/${e.path}`), this.configureNative(e), 
        this.configureServer(e), this.start(e, t);
    }
    on(e, t) {
        super.on(e, t);
    }
    broadcast(e, t) {
        this.serverGroup && native.server.group.broadcast(this.serverGroup, e, t && t.binary || !1);
    }
    startAutoPing(e, t) {
        this.serverGroup && native.server.group.startAutoPing(this.serverGroup, e, t ? APP_PING_CODE : null);
    }
    close(e) {
        this.upgradeListener && this.httpServer && (this.httpServer.removeListener("upgrade", this.upgradeListener), 
        this.serverIsProvided || this.httpServer.close()), this.serverGroup && (native.server.group.close(this.serverGroup), 
        this.serverGroup = null), e && setTimeout(e, 2e4);
    }
    start(e, t) {
        e.port && this.httpServer.listen(e.port, e.host || null, () => {
            this.emit("listening"), t && t();
        });
    }
    configureServer(e) {
        this.serverIsProvided = !!e.server, this.httpServer = e.server || HTTP.createServer((e, t) => t.end()), 
        this.upgradeListener = ((t, r) => {
            if (r.on("error", e => this.emit("error", e, r)), r.on("_tlsError", e => this.emit("error", e, r)), 
            e.path && e.path !== t.url.split("?")[0].split("#")[0]) return this.lastUpgradeListener ? this.dropConnection(r, 400, "URL not supported") : null;
            if (e.verifyClient) {
                const s = {
                    req: t,
                    headers: t.headers,
                    secure: !!(t.connection instanceof tls.TLSSocket && (t.connection.authorized || t.connection.encrypted))
                };
                return e.verifyClient(s, (e, s, n) => e ? this.handleUpgrade(t, r) : this.dropConnection(r, s, n));
            }
            return this.handleUpgrade(t, r);
        }), this.httpServer.on("error", e => this.emit("error", e)), this.httpServer.on("upgrade", this.upgradeListener), 
        this.httpServer.on("newListener", (e, t) => "upgrade" === e ? this.lastUpgradeListener = !1 : null);
    }
    configureNative(e) {
        let t = 0;
        e.perMessageDeflate && (t |= e.perMessageDeflate.serverNoContextTakeover ? PERMESSAGE_DEFLATE : SLIDING_DEFLATE_WINDOW), 
        this.serverGroup = native.server.group.create(t, e.maxPayload || DEFAULT_PAYLOAD_LIMIT), 
        native.server.group.onConnection(this.serverGroup, e => {
            const t = new WebSocket(null, e, !0);
            native.setUserData(e, t), this.emit("connection", t, this.upgradeReq), this.upgradeReq = null;
        }), native.server.group.onMessage(this.serverGroup, (e, t) => {
            t.emit("message", e);
        }), native.server.group.onDisconnection(this.serverGroup, (e, t, r, s) => {
            s.external = null, process.nextTick(() => {
                s.emit("close", t, r), s = null;
            }), native.clearUserData(e);
        }), native.server.group.onPing(this.serverGroup, (e, t) => t.emit("ping", e)), native.server.group.onPong(this.serverGroup, (e, t) => t.emit("pong", e));
    }
    dropConnection(e, t, r) {
        return e.end(`HTTP/1.1 ${t} ${r}\r\n\r\n`);
    }
    handleUpgrade(e, t) {
        const r = e.headers["sec-websocket-key"], s = t, n = s.ssl ? native.getSSLContext(s.ssl) : null, i = s.ssl ? s._parent._handle : s._handle;
        if (i && r && 24 === r.length) {
            t.setNoDelay(this.noDelay);
            const s = native.transfer(-1 === i.fd ? i : i.fd, n);
            t.on("close", (t, n) => {
                this.serverGroup && (this.upgradeReq = e, native.upgrade(this.serverGroup, s, r, e.headers["sec-websocket-extensions"], e.headers["sec-websocket-protocol"]));
            });
        }
        t.destroy();
    }
}

exports.WebSocket = WebSocket, exports.WebSocketServer = WebSocketServer;
