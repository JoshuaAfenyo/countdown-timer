import { DurableObject } from "cloudflare:workers";

// Only /ws reaches this Worker (see run_worker_first in wrangler.jsonc). It hands the connection to one shared "room".
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/ws") return env.ASSETS.fetch(req);
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    try {
      const origin = req.headers.get("Origin");
      if (origin && new URL(origin).host !== url.host) return new Response("Forbidden", { status: 403 });
    } catch (e) {
      return new Response("Forbidden", { status: 403 });
    }
    return env.ROOM.get(env.ROOM.idFromName("main")).fetch(req);
  },
};

const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch (e) {} };
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Two roles connect: the "controller" (the computer's control page, which runs the timer) and "remote" (phones).
// Phones send commands to the controller. The controller sends its state to the phones.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Lets clients send "ping" and get "pong" without waking the room, so connections can be checked cheaply.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server); // hibernation API: no charges while idle
    server.serializeAttachment({ role: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  sockets(role, except) {
    return this.ctx.getWebSockets().filter(s =>
      s !== except && s.readyState === 1 && (s.deserializeAttachment() || {}).role === role);
  }

  presence(except) {
    const online = this.sockets("controller", except).length > 0;
    for (const r of this.sockets("remote", except)) send(r, { type: "presence", controller: online });
  }

  // After 5 wrong PINs, every attempt is refused for one minute.
  async checkPin(pin) {
    const pinSecret = this.env.REMOTE_PIN;
    if (!pinSecret) return "unconfigured";
    if (Date.now() < ((await this.ctx.storage.get("lockUntil")) || 0)) return "locked";
    const fails = (await this.ctx.storage.get("fails")) || 0;
    if (safeEqual(pin, String(pinSecret))) {
      if (fails) await this.ctx.storage.put("fails", 0);
      return "ok";
    }
    if (fails + 1 >= 5) {
      await this.ctx.storage.put("lockUntil", Date.now() + 60000);
      await this.ctx.storage.put("fails", 0);
    } else {
      await this.ctx.storage.put("fails", fails + 1);
    }
    return "pin";
  }

  async auth(ws, msg) {
    if (msg.type !== "auth" || (msg.role !== "controller" && msg.role !== "remote")) { ws.close(1008, "auth required"); return; }
    const result = await this.checkPin(String(msg.pin ?? ""));
    if (result !== "ok") { send(ws, { type: "denied", reason: result }); ws.close(1008, "denied"); return; }
    ws.serializeAttachment({ role: msg.role });
    if (msg.role === "controller") {
      for (const old of this.sockets("controller", ws)) { try { old.close(4000, "replaced"); } catch (e) {} }
      send(ws, { type: "ready" });
      this.presence();
    } else {
      send(ws, { type: "ready", controller: this.sockets("controller").length > 0 });
      for (const c of this.sockets("controller")) send(c, { type: "hello" }); // ask the controller to resend its state
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 2000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const { role } = ws.deserializeAttachment() || {};
    if (!role) { await this.auth(ws, msg); return; }
    if (role === "remote" && msg.type === "cmd") for (const c of this.sockets("controller")) c.send(raw);
    else if (role === "controller" && msg.type === "state") for (const r of this.sockets("remote")) r.send(raw);
  }

  async webSocketClose(ws) {
    try { ws.close(1000, "closed"); } catch (e) {}
    this.presence(ws);
  }
  async webSocketError(ws) { this.presence(ws); }
}
