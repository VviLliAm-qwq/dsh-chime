/**
 * dsh-chime — WAV gain scaling (pure functions, no I/O).
 *
 * `scaleWav` scales a RIFF/WAVE (PCM, 16-bit) buffer's samples by
 * `volumePercent / 100` with 16-bit saturation, preserving the original
 * layout (header and unknown chunks untouched, only the `data` block is
 * rewritten). The result can be handed to PlaySoundW with SND_MEMORY.
 *
 * >100% gain saturates at ±32767 — a short notification tone tolerates the
 * clipping; a soft-limiter pass could be a future refinement.
 *
 * @module dsh-chime/wav
 */

const FORMAT_PCM = 1;

/** Read a RIFF chunk; returns `{ header, size }` (header = chunk payload offset). */
function findChunk(buf, id, from) {
    let off = from;
    while (off + 8 <= buf.length) {
        if (buf.toString('ascii', off, off + 4) === id) {
            return { header: off + 8, size: buf.readUInt32LE(off + 4) };
        }
        const size = buf.readUInt32LE(off + 4);
        off += 8 + size + (size % 2); // chunks pad to even lengths
    }
    return null;
}

/**
 * Scale the PCM samples of a WAV buffer by `volumePercent / 100`.
 *
 * Supports PCM only (format 1, any channel count, 16-bit samples — exactly
 * what `scripts/gen-sounds.mjs` produces). 100% returns the input buffer
 * unchanged; the caller keeps the buffer alive as long as it is in use.
 *
 * @param {Buffer} wav - Source WAV (RIFF/WAVE, PCM 16-bit).
 * @param {number|string} volumePercent - 0..150 (clamped); anything invalid
 *   falls back to 100.
 * @returns {Buffer} The scaled buffer (same Buffer for 100%, otherwise a copy).
 */
export function scaleWav(wav, volumePercent) {
    if (!Buffer.isBuffer(wav)) throw new TypeError('scaleWav: expected a Buffer');
    if (wav.length < 44) throw new Error('scaleWav: not a WAV (too short)');
    if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('scaleWav: not a RIFF/WAVE file');
    }
    const fmt = findChunk(wav, 'fmt ', 12);
    const data = findChunk(wav, 'data', 12);
    if (fmt === null || data === null) throw new Error('scaleWav: missing fmt or data chunk');
    const format = fmt.header + 0;
    const channels = fmt.header + 2;
    const bitsPerSample = fmt.header + 14;
    if (wav.readUInt16LE(format) !== FORMAT_PCM) throw new Error('scaleWav: only PCM WAV supported');
    if (wav.readUInt16LE(bitsPerSample) !== 16) throw new Error('scaleWav: only 16-bit PCM supported');
    if (wav.readUInt16LE(channels) < 1) throw new Error('scaleWav: bad channel count');

    const raw = Number.parseFloat(String(volumePercent ?? ''));
    const value = Number.isFinite(raw) ? raw : 100;
    const gain = Math.min(150, Math.max(0, value)) / 100;
    if (gain === 1) return wav;

    const count = Math.floor(data.size / 2);
    const out = Buffer.allocUnsafe(wav.length);
    wav.copy(out);
    for (let i = 0; i < count; i++) {
        const at = data.header + i * 2;
        const scaled = Math.round(wav.readInt16LE(at) * gain);
        out.writeInt16LE(scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : scaled, at);
    }
    return out;
}
