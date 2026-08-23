/* =============================================================
   TheRacingData — minimal zip reader.

   A .docx is a zip. Comparing two exports byte for byte compares
   their local file headers too, and those carry a modification
   time stamped at render time, so two renders of the same report
   a second apart are never identical. What has to be identical is
   the content: every entry, same name, same bytes.

   Reads the central directory rather than scanning for signatures,
   so an entry whose data happens to contain a header signature
   cannot throw the parse off.
   ============================================================= */

import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CEN  = 0x02014b50;

export function entries(bytes) {
  const buf = Buffer.from(bytes);

  // The end-of-central-directory record is last, but a trailing comment
  // may follow it. Scan back over the largest comment the format allows.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);

  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== CEN) throw new Error(`central directory entry ${n} corrupt`);
    const method   = buf.readUInt16LE(at + 10);
    const compSize = buf.readUInt32LE(at + 20);
    const nameLen  = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const cmtLen   = buf.readUInt16LE(at + 32);
    const localAt  = buf.readUInt32LE(at + 42);
    const name     = buf.toString('utf8', at + 46, at + 46 + nameLen);

    // The local header repeats the name and may carry different extra
    // fields, so the data offset is read from the local header itself.
    const lNameLen  = buf.readUInt16LE(localAt + 26);
    const lExtraLen = buf.readUInt16LE(localAt + 28);
    const start = localAt + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);

    // Zip entries are raw DEFLATE, not zlib-wrapped.
    out.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));
    at += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

/* word/document.xml, as text. The one entry every assertion is about. */
export function documentXml(bytes) {
  const xml = entries(bytes).get('word/document.xml');
  if (!xml) throw new Error('document.xml not found');
  return xml.toString('utf8');
}
