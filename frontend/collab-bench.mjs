import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'

const UUID = '4a29608a-1f1b-4457-84fc-67518f847743' // 36-char node id, as on the wire
const b64 = (u8) => Buffer.from(u8).toString('base64')
const envJson = (bb) =>
  JSON.stringify({ type: 'doc_update', node_id: UUID, sub: 'update', update: bb }).length
// Binary framing hypothesis: 1 byte msg-type tag + 16 raw bytes node id + payload
const BIN_HDR = 17

// --- realistic typing session: a paragraph, one char per keystroke -----------
const paragraph =
  'The quick brown fox jumps over the lazy dog. '.repeat(7) // ~315 chars
const doc = new Y.Doc()
const ytext = doc.getText('content')
const updates = []
doc.on('update', (u) => updates.push(u))
for (const ch of paragraph) ytext.insert(ytext.length, ch)

const n = updates.length
const rawTotal = updates.reduce((s, u) => s + u.length, 0)
const b64Total = updates.reduce((s, u) => s + b64(u).length, 0)
const jsonTotal = updates.reduce((s, u) => s + envJson(b64(u)), 0)
const binTotal = updates.reduce((s, u) => s + u.length + BIN_HDR, 0)

console.log(`\n=== Typing session: ${n} keystrokes (${paragraph.length} chars) ===`)
console.log(`per-keystroke avg:  raw Yjs update = ${(rawTotal / n).toFixed(1)} B`)
console.log(`                    base64         = ${(b64Total / n).toFixed(1)} B  (+${((b64Total / rawTotal - 1) * 100).toFixed(0)}%)`)
console.log(`                    full JSON msg   = ${(jsonTotal / n).toFixed(1)} B  (envelope+base64)`)
console.log(`                    binary frame    = ${(binTotal / n).toFixed(1)} B`)

// --- tick batching: merge all updates in a window into ONE message -----------
function batched(N) {
  let msgs = 0, json = 0, bin = 0
  for (let i = 0; i < updates.length; i += N) {
    const merged = Y.mergeUpdates(updates.slice(i, i + N))
    msgs++
    json += envJson(b64(merged))
    bin += merged.length + BIN_HDR
  }
  return { msgs, json, bin }
}

console.log(`\n=== Whole paragraph, total wire cost ===`)
const rows = [
  ['current (JSON+b64, 1 msg/key)', n, jsonTotal, jsonTotal],
  ['binary frames, 1 msg/key', n, binTotal, binTotal],
]
for (const N of [3, 5, 10]) {
  const b = batched(N)
  rows.push([`batch ~${N}/tick + JSON`, b.msgs, b.json, b.json])
  rows.push([`batch ~${N}/tick + binary`, b.msgs, b.bin, b.bin])
}
console.log('scheme'.padEnd(34), 'msgs'.padStart(6), 'bytes'.padStart(8), 'vs current')
for (const [name, msgs, bytes] of rows) {
  const pct = ((bytes / jsonTotal - 1) * 100)
  const tag = pct <= 0 ? `${pct.toFixed(0)}%` : `+${pct.toFixed(0)}%`
  console.log(name.padEnd(34), String(msgs).padStart(6), String(bytes).padStart(8), tag.padStart(9))
}

// --- awareness (cursor) update size, for context -----------------------------
const aw = new Awareness(doc)
aw.setLocalState({ cursor: { anchor: 42, head: 47 }, user: { name: 'Victor', color: '#6366f1' } })
const awU = encodeAwarenessUpdate(aw, [doc.clientID])
console.log(`\n=== Awareness (cursor) update ===`)
console.log(`raw = ${awU.length} B | base64 = ${b64(awU).length} B | full JSON = ${JSON.stringify({ type: 'doc_awareness', node_id: UUID, update: b64(awU) }).length} B`)
