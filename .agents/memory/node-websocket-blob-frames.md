---
name: Node native WebSocket delivers binary frames as Blob
description: Why a "connected" WebSocket client can silently receive zero usable messages, and how to decode frames correctly.
---

# Node native WebSocket (undici) — binary frames arrive as Blob, not string

When using the runtime global `WebSocket` (Node 22+/undici) as a client, the
`message` event's `ev.data` is a **Blob** for binary frames (and `ArrayBuffer`
/ TypedArray in some cases), NOT a string. Many servers (e.g. AISStream) send
their JSON payloads as binary frames.

**Symptom (the trap):** a handler that does `String(ev.data)` produces the
literal `"[object Blob]"`, `JSON.parse` throws, and if the throw is swallowed in
a `catch {}` you get a client that connects fine (`open` fires, no errors) but
processes **zero** messages. It looks exactly like upstream data sparsity.

**Why:** browser-style `String(blob)` does not decode the bytes; Blob decoding
is async (`await blob.text()`).

**How to apply — decode before parsing:**
```js
const d = ev.data;
let raw;
if (typeof d === "string") raw = d;
else if (d instanceof Blob) raw = await d.text();          // handler must be async
else if (d instanceof ArrayBuffer) raw = Buffer.from(d).toString("utf8");
else if (ArrayBuffer.isView(d)) raw = Buffer.from(d.buffer, d.byteOffset, d.byteLength).toString("utf8");
else raw = String(d);
const msg = JSON.parse(raw);
```

**Diagnostic trick:** if a WebSocket source returns "connected but empty",
write a tiny standalone node script that subscribes to a broad/global filter and
logs `typeof ev.data` + `ev.data.constructor.name`. Seeing `object / Blob`
confirms this bug rather than sparsity.
