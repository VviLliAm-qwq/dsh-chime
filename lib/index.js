/**
 * dsh-chime — notification sounds for dsh-tui.
 *
 * Plays a distinct sound on two conversation events:
 *   - the agent asks the user something via the ask_user_question tool
 *     (session/event `tool/call`, `name === 'ask_user_question'`) — the
 *     "user has to answer, come back" cue
 *   - the assistant turn finishes    (session/event `turn/end`)
 * with separate variants for focused vs unfocused terminal windows.
 * Four sound groups (g1 crisp / g2 wood / g3 chiptune / g4 warm) are
 * selectable per scenario in a dedicated settings section (zh/en); a master
 * volume (0%–150%, 5% steps) gains the PCM samples before playback
 * (lib/wav.js scales in memory; PlaySoundW gets SND_MEMORY buffers, so
 * >100% just saturates — no global waveOut volume is touched).
 *
 * Windows integration is done through koffi (user32/kernel32/winmm):
 * focus polling = GetForegroundWindow vs GetConsoleWindow handle OR the
 * window class (CASCADIA_HOSTING_WINDOW_CLASS for Windows Terminal,
 * ConsoleWindowClass for classic conhost; ConPTY's hidden
 * PseudoConsoleWindow is never the foreground), playback via PlaySoundW
 * (async, no console output).
 *
 * Event source: the `session/event` cordis bus, published by
 * `@deepseek-ai/dsh-session` on every committed session event (the same
 * channel the official `dsh-working-activity` extension uses) — NOT the
 * grant-gated `tuiMessageObserver.subscribe` mediated API.
 *
 * Why: a bundle-patch mounted plugin is never put through host admission, so
 * its Cordis activation has no verified dsh-plugin.json Component identity
 * and the mediated observer rejects every subscribe
 * (`COMPONENT_NOT_ADMITTED`), leaving the plugin deaf. The bus subscription
 * needs no identity: the same events, no admission.
 *
 * Host services (settings / settings-sections) are resolved at runtime and
 * retried until they appear — the issue-#183 pattern: an absent service
 * degrades THIS plugin, never the boot.
 *
 * @module dsh-chime
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import z from '@deepseek-ai/schemastery';
import koffi from 'koffi';
import { scaleWav } from './wav.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOUND_DIR = join(HERE, '..', 'assets', 'sounds');
const DIAG_LOG = join(homedir(), '.dsh-tui', 'dsh-chime.log');

/** Append a diagnostic line (best-effort; never throws). */
function diag(line) {
    try { appendFileSync(DIAG_LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* ignore */ }
}

/** Plugin name; always the install id. */
export const name = 'chime';

/** Settings schema: one sound group per scenario plus a master volume. */
export const Config = z.object({
    doneFocus: z.string().default('g1'),
    doneBlur: z.string().default('g2'),
    askFocus: z.string().default('g3'),
    askBlur: z.string().default('g4'),
    /** Volume in percent, as a string (select values are strings): '0'..'150'. */
    volume: z.string().default('100'),
});
/** Explicit boot defaults (mirrors the schema defaults). */
const DEFAULT_CONFIG = { doneFocus: 'g1', doneBlur: 'g2', askFocus: 'g3', askBlur: 'g4', volume: '100' };

/** scenario key -> wav file stem. */
const SCENARIO_FILE = {
    doneFocus: 'done-focus',
    doneBlur: 'done-blur',
    askFocus: 'ask-focus',
    askBlur: 'ask-blur',
};
const GROUP_OPTIONS = [
    { value: 'g1', label: 'Crisp', descriptions: { zh: '清脆电子', en: 'Crisp' } },
    { value: 'g2', label: 'Wood', descriptions: { zh: '木质敲击', en: 'Wood' } },
    { value: 'g3', label: 'Chiptune', descriptions: { zh: '八比特', en: 'Chiptune' } },
    { value: 'g4', label: 'Warm', descriptions: { zh: '温馨钢琴', en: 'Warm' } },
    { value: 'off', label: 'Off', descriptions: { zh: '关闭', en: 'Off' } },
];
/** Volume choices: 0%–150% in 5% steps (stored as plain value strings). */
const VOLUME_OPTIONS = Array.from({ length: 31 }, (_, i) => {
    const v = i * 5;
    return { value: String(v), label: `${v}%` };
});
const VOLUME_MIN = 0;
const VOLUME_MAX = 150;
/** scenario field key -> [en label, localized descriptions]. */
const FIELD_LABELS = {
    doneFocus: ['Done (focused)', { zh: '完成对话·聚焦时', en: 'Done (focused)' }],
    doneBlur: ['Done (unfocused)', { zh: '完成对话·未聚焦时', en: 'Done (unfocused)' }],
    askFocus: ['Question (focused)', { zh: '提问·聚焦时', en: 'Question (focused)' }],
    askBlur: ['Question (unfocused)', { zh: '提问·未聚焦时', en: 'Question (unfocused)' }],
};

// Win32 constants for PlaySoundW (memory playback, async, no system beep).
const SND_MEMORY = 0x0004;
const SND_ASYNC = 0x0001;
const SND_NODEFAULT = 0x0002;
const THROTTLE_MS = 700;
const RETRY_MS = 400;
const RETRY_LIMIT = 60; // ~24s of service readiness attempts
// Playback pool: SND_MEMORY playback needs the buffer alive until the sound
// finishes; slots are reused only after a long cooldown (sounds ≤1.3s, so 8
// slots × 5s covers 40s of uninterrupted play — an idle slot is a safe one).
const POOL_SIZE = 8;
const POOL_COOLDOWN_MS = 5000;

/** Lazy, shared Win32 bindings (koffi). */
let win32 = null;
function loadWin32() {
    if (win32 === null) {
        const pvoid = koffi.pointer('void');
        const api = (lib, name, result, args) => lib.func('__stdcall', name, result, args);
        const user32 = koffi.load('user32.dll');
        const winmm = koffi.load('winmm.dll');
        const kernel32 = koffi.load('kernel32');
        const win32Local = {
            getForegroundWindow: api(user32, 'GetForegroundWindow', 'uintptr_t', []),
            getClassNameW: api(user32, 'GetClassNameW', 'int', ['uintptr_t', 'void*', 'int']),
            playSound: api(winmm, 'PlaySoundW', 'int', ['void*', pvoid, 'uint32']),
            consoleWindow: null,
            // console hosts accept these two top-level window classes (fallback
            // only — the primary check is the handle comparison below)
            hostClasses: ['ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS'],
        };
        try {
            win32Local.consoleWindow = api(kernel32, 'GetConsoleWindow', 'uintptr_t', []);
        }
        catch {
            win32Local.consoleWindow = null;
        }
        win32 = win32Local;
    }
    return win32;
}

/**
 * Whether the current foreground window is THIS terminal window.
 * Two reliable checks, OR'ed:
 *   1. handle equality with GetConsoleWindow — classic console hosts expose
 *      their own top-level window there;
 *   2. class-name match — Windows Terminal (CASCADIA_HOSTING_WINDOW_CLASS)
 *      and classic conhost (ConsoleWindowClass); needed because on ConPTY
 *      GetConsoleWindow returns the hidden PseudoConsoleWindow, never the
 *      foreground window. Class text is read as `n` UTF-16 chars (the
 *      byte-index scan miss-reads the alternating NUL bytes).
 */
function isTerminalFocused(w) {
    try {
        const fg = w.getForegroundWindow();
        if (fg === null || fg === 0) return false;
        if (w.consoleWindow !== null) {
            const own = w.consoleWindow();
            if (own !== null && own !== 0 && fg === own) return true;
        }
        const buf = Buffer.alloc(400);
        const n = w.getClassNameW(fg, buf, 200);
        if (n > 0) {
            const cls = buf.subarray(0, Math.min(n, 200) * 2).toString('utf16le');
            if (w.hostClasses.includes(cls)) return true;
        }
        return false;
    }
    catch {
        return true; // keep the previous (focused) assumption on Win32 hiccups
    }
}

function sessionIdOf(session) {
    if (session == null) return undefined;
    return session.id ?? session.header?.id ?? session.sessionId;
}

/** Whether a session is a subagent child (its own event stream). */
function isSubagentSession(session) {
    try {
        const header = session?.header ?? session?.meta;
        return header?.origin === 'subagent' || (header?.delegationDepth ?? 0) > 0;
    }
    catch {
        return false;
    }
}

/** Mount the settings section (display metadata only). */
function registerSection(sections) {
    const fields = [
        {
            path: ['volume'],
            label: 'Volume',
            descriptions: { zh: '音量', en: 'Volume' },
            hint: '←/→ steps 5%, hold to repeat; >100% may clip',
            hintDescriptions: { zh: '←/→ 每次 ±5%，长按连续调节；超过 100% 可能削波', en: '←/→ steps 5%, hold to repeat; >100% may clip' },
            kind: 'select',
            options: VOLUME_OPTIONS,
        },
        ...['doneFocus', 'doneBlur', 'askFocus', 'askBlur'].map((key) => {
            const [label, descriptions] = FIELD_LABELS[key];
            return {
                path: [key],
                label,
                descriptions,
                kind: 'select',
                options: GROUP_OPTIONS,
            };
        }),
    ];
    return sections.register({
        ns: 'chime',
        title: 'Notice Sounds',
        descriptions: { zh: '提示音效', en: 'Notice Sounds' },
        fields,
    });
}

/**
 * Cordis plugin entry. All services are resolved at runtime through
 * ctx.get (retried until they appear) so an absent/late service degrades
 * this plugin, never the boot. Message events come from the session/event
 * bus (no Component identity required — see module header).
 */
export function apply(ctx, config) {
    diag('apply started');
    if (process.platform !== 'win32') {
        // TUI-RUN-001: the plugin is Win32-only (winmm/user32 via koffi); on
        // other platforms it degrades to a no-op — never a boot failure.
        diag(`platform=${process.platform}: sounds disabled (Win32-only)`);
        ctx.logger.warn(`chime: Win32-only plugin (winmm/user32); notification sounds will not play on ${process.platform}`);
    }
    ctx.effect(function* () {
        let scope = null;
        let sectionRegistered = false;
        let sectionDisposer = null;
        let focusStarted = false;
        let attempts = 0;
        let retryTimer = null;

        // ── playback state ────────────────────────────────────────────
        const lastPlay = new Map();
        const wavCache = new Map(); // wav file path -> source Buffer
        const playPool = Array.from({ length: POOL_SIZE }, () => ({ buf: null, usedAt: 0 }));
        let wrappedPrev = { ...DEFAULT_CONFIG };
        let focused = true;
        let focusTimer = null;
        let loaded = null;

        /** Clamp the stored volume string to 0..150 (invalid -> 100). */
        function clampVolume(raw) {
            const n = Number.parseInt(String(raw ?? ''), 10);
            if (!Number.isFinite(n)) return 100;
            return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, n));
        }

        /** Oldest pool slot past its cooldown, else the oldest slot (reuse).
         *  All slots start cold, so a playing buffer is never overwritten
         *  within 5s — far beyond the longest sound's 1.3s. */
        function takePoolSlot() {
            const now = Date.now();
            let candidate = null;
            let oldest = playPool[0];
            for (const slot of playPool) {
                if (slot.usedAt < oldest.usedAt) oldest = slot;
                if (now - slot.usedAt > POOL_COOLDOWN_MS &&
                    (candidate === null || slot.usedAt < candidate.usedAt)) {
                    candidate = slot;
                }
            }
            const slot = candidate ?? oldest;
            slot.usedAt = now;
            return slot;
        }

        function play(scenarioKey) {
            try {
                const cfg = scope !== null && scope.get() ? { ...DEFAULT_CONFIG, ...scope.get() } : { ...DEFAULT_CONFIG };
                const group = cfg[scenarioKey];
                if (group === undefined || group === null || group === 'off') { diag(`play ${scenarioKey}: off/empty`); return; }
                const now = Date.now();
                const prev = lastPlay.get(scenarioKey) ?? 0;
                if (now - prev < THROTTLE_MS) { diag(`play ${scenarioKey}: throttled`); return; }
                lastPlay.set(scenarioKey, now);
                const file = join(SOUND_DIR, `${group}-${SCENARIO_FILE[scenarioKey]}.wav`);
                const volume = clampVolume(cfg.volume);
                let source = wavCache.get(file);
                if (source === undefined) {
                    source = readFileSync(file);
                    wavCache.set(file, source);
                }
                const buffer = scaleWav(source, volume);
                const slot = takePoolSlot();
                slot.buf = buffer; // keep alive while winmm plays it
                loaded ??= loadWin32();
                const result = loaded.playSound(buffer, null, SND_MEMORY | SND_ASYNC | SND_NODEFAULT);
                diag(`play ${scenarioKey}: group=${group} file=${file} volume=${volume}% winmm=${result}`);
            }
            catch (error) {
                diag(`play FAIL ${scenarioKey}: ${error instanceof Error ? error.message : String(error)}`);
                ctx.logger.warn(`chime: play failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // ── session/event bus listener (one subscription, all sessions) ─
        // Diag keeps only low-volume events: assistant/chunk fires hundreds of
        // times per second and would grow the log unboundedly.
        const DIAG_TYPES = new Set([
            'user/message', 'turn/start', 'turn/end', 'assistant/message',
            'tool/call', 'tool/result', 'step/start', 'step/end', 'request/header',
        ]);
        function onSessionEvent(session, event) {
            const type = event?.type;
            if (DIAG_TYPES.has(type)) diag(`session/event type=${type} session=${sessionIdOf(session) ?? '?'}`);
            if (type === 'tool/call' && event?.data?.name === 'ask_user_question') {
                // The maid invoked the user-question module: the user has to
                // answer something — cue them even when the terminal is blurred.
                diag(`ask_user_question detected (session=${sessionIdOf(session) ?? '?'})`);
                play(focused ? 'askFocus' : 'askBlur');
            }
            else if (type === 'turn/end') {
                // agent-loop emits exactly one turn/end per assistant round
                // (assistant/message would fire once per tool step — noise).
                // Subagent children have their own stream; a parent's turn is
                // what the user waits on, so their sound would be noise too.
                if (isSubagentSession(session)) return;
                play(focused ? 'doneFocus' : 'doneBlur');
            }
        }
        ctx.on('session/event', onSessionEvent);
        diag('session/event listener attached');

        // ── focus polling (console-window handle based) ───────────────
        function startFocus() {
            if (focusStarted) return;
            try {
                const w = loadWin32();
                focusStarted = true;
                focusTimer = setInterval(() => {
                    try {
                        const isFocused = isTerminalFocused(w);
                        if (isFocused !== focused) {
                            focused = isFocused;
                            ctx.logger.debug(`chime: terminal ${focused ? 'focused' : 'blurred'}`);
                        }
                    }
                    catch {
                        // transient Win32 failure — keep the last known state
                    }
                }, 750);
            }
            catch (error) {
                ctx.logger.warn(`chime: focus detection unavailable (always treated as focused): ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // ── service-readiness poll ────────────────────────────────────
        function tryOnce() {
            // settings namespace + settings section
            if (scope === null) {
                const settings = ctx.get('settings');
                if (settings !== undefined) {
                    try {
                        scope = settings.register('chime', Config);
                        diag('settings namespace registered');
                        ctx.logger.info('chime: settings namespace registered');
                        // preview: play the newly selected group for the changed scenario
                        let prev = { ...DEFAULT_CONFIG };
                        try { prev = { ...DEFAULT_CONFIG, ...scope.get() }; } catch { /* ignore */ }
                        scope.watch((next) => {
                            const merged = { ...DEFAULT_CONFIG, ...next };
                            let played = false;
                            for (const key of ['doneFocus', 'doneBlur', 'askFocus', 'askBlur']) {
                                if (merged[key] !== undefined && wrappedPrev[key] !== merged[key] && merged[key] !== 'off') {
                                    play(key);
                                    played = true;
                                }
                            }
                            // Volume-only change: preview one live scenario so the
                            // user hears the new level immediately (group-change
                            // previews above take precedence).
                            if (!played && merged.volume !== wrappedPrev.volume) {
                                const key = ['doneFocus', 'doneBlur', 'askFocus', 'askBlur']
                                    .find(k => merged[k] !== undefined && merged[k] !== 'off');
                                if (key !== undefined) play(key);
                            }
                            wrappedPrev = { ...merged };
                        });
                    }
                    catch (error) {
                        ctx.logger.warn(`chime: settings register failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            if (!sectionRegistered) {
                const sections = ctx.get('tuiSettingsSections');
                if (sections !== undefined) {
                    try {
                        sectionDisposer = registerSection(sections);
                        sectionRegistered = true;
                    }
                    catch (error) {
                        ctx.logger.warn(`chime: settings section failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            startFocus();

            // done?
            if (scope !== null && sectionRegistered && focusStarted) {
                if (retryTimer !== null) { clearInterval(retryTimer); retryTimer = null; }
                diag('readiness complete');
            }
            else if (++attempts >= RETRY_LIMIT) {
                diag(`readiness timeout (settings=${scope !== null}, section=${sectionRegistered}, focus=${focusStarted})`);
                ctx.logger.warn(`chime: services did not all appear within ${(RETRY_LIMIT * RETRY_MS) / 1000}s (settings=${scope !== null}, section=${sectionRegistered}, focus=${focusStarted})`);
                if (retryTimer !== null) { clearInterval(retryTimer); retryTimer = null; }
            }
        }

        retryTimer = setInterval(tryOnce, RETRY_MS);
        tryOnce();

        yield () => {
            if (retryTimer !== null) clearInterval(retryTimer);
            if (focusTimer !== null) clearInterval(focusTimer);
            try { sectionDisposer?.(); } catch { /* best-effort */ }
            // The session/event listener is owned by this activation: cordis
            // removes it on fiber teardown, nothing else to do.
        };
    }, 'chime lifecycle');
}
