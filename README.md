# dsh-chime-sound

[![ci](https://github.com/VviLliAm-qwq/dsh-chime/actions/workflows/ci.yml/badge.svg)](https://github.com/VviLliAm-qwq/dsh-chime/actions/workflows/ci.yml)

**English** · [中文](README.zh.md)

Built for [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI).

Notification sounds for dsh-tui (originally named dsh-notice-sound, renamed on 2026-09-07).

- **Triggers:** the agent calling `ask_user_question` (`session/event` `tool/call` — a nudge to come back and answer) and a reply finishing (`session/event` `turn/end`; agent-loop emits this once per turn, while `assistant/message` fires on every tool step and is deliberately not used). Both distinguish a focused from an unfocused terminal.
- **9 sound groups × 4 situations**, selectable (or off) in the settings page's “Notice Sounds” section: g1 Crisp / g2 Wood / g3 Chiptune / g4 Warm (synthesised in code), g5 Bell / g6 Bubble / g7 Arcade / g8 Marimba / g9 Soft Synth (CC0 samples).
- **New in 0.2.0 — master volume** (the “Volume” field): 0–150% in 5% steps (31 steps), default 100% = the original level. `←/→` steps 5%; **holding the key repeats**, because dsh-tui's input layer expands the auto-repeat into per-step events. The new level is auditioned immediately. Above 100% the samples are 16-bit saturated (peak ≈ 105%, clipping only for very short stretches). The gain is applied to the WAV samples inside the plugin and never touches system volume.
- g1–g4 are synthesised by this repository's `scripts/gen-sounds.mjs` (WAV, 16-bit / 48 kHz); g5–g9 are [Freesound](https://freesound.org) **CC0 1.0** material, decoded and then trimmed, faded and loudness-normalised to the same format. Sources and conversion parameters are recorded in `assets/sounds/CREDITS.md` (CC0 needs no attribution and may be redistributed with this plugin).
- Settings and copy are bilingual (Chinese/English); the settings card is localised by the host according to the language dsh-tui's `/lang` selected.

## ⚠️ Platform support (Windows only)

Sound is played through **Win32 APIs** (koffi → `winmm.dll` `PlaySoundW`, with focus detection via `user32.dll`), so this plugin is **Windows-only** (Windows Terminal and classic conhost). On Linux and macOS it degrades silently to a no-op — no sound, no boot failure — and logs a `Win32-only` warning. Do not expect notification sounds elsewhere.

## Install

**Option 1 — dsh CLI (recommended):**

```sh
dsh plugin --profile <profile> add dsh-chime-sound
```

(Or from the dsh plugin market / GitHub: `dsh plugin add github:VviLliAm-qwq/dsh-chime`.)

**Option 2 — manual:**

1. Copy the package to `~/.dsh/profiles/dsh-tui/node_modules/dsh-chime-sound/`
2. Append `"dsh-chime-sound"` to `dsh.profile.bundles` in `~/.dsh/profiles/dsh-tui/package.json` (the package declares `dsh.bundle.patch`, so it mounts itself at boot)
3. Restart dsh-tui (`/restart`)

**Compatibility:** dsh-tui 0.10.x (the `ctx.tuiSettingsSections` and `session/event` seams, both soft-probed); dsh 0.1.2-rc.1+; Node `^22.19 || >=24`; pure ESM. Every configuration key has a default, and a missing configuration degrades to “nothing happens”.

## Configuration

The settings live in dsh-tui's “Notice Sounds” section (or the `chime:` namespace of `~/.dsh/settings.yaml`):

```yaml
chime:
  doneFocus: g2   # reply finished, terminal focused: g1-g9 / off
  doneBlur: g2    # reply finished, terminal unfocused
  askFocus: g2    # question asked, terminal focused
  askBlur: g2     # question asked, terminal unfocused
  volume: "50"    # 0-150, 5% steps, default "100"
```

## Why `session/event` and not the message observer

dsh-tui's mediated `tuiMessageObserver.subscribe()` is unusable here: the API requires the activation to hold a verified Component identity through host admission, and a plugin mounted by a bundle patch never goes through admission — its subscriptions are refused (`COMPONENT_NOT_ADMITTED`) and no sound ever plays.

This plugin therefore listens on the `session/event` cordis bus published by `@deepseek-ai/dsh-session` (the same channel the official `dsh-working-activity` extension uses), which needs no Component identity:

- `tool/call` with `name === 'ask_user_question'` → the question sound (askFocus / askBlur)
- `turn/end` → the completion sound (doneFocus / doneBlur); subagent sessions are ignored
- **Focus detection:** the `GetForegroundWindow` handle equals `GetConsoleWindow`, or the window class matches (`CASCADIA_HOSTING_WINDOW_CLASS` = Windows Terminal, `ConsoleWindowClass` = classic conhost). Under ConPTY `GetConsoleWindow` returns a hidden `PseudoConsoleWindow` that is never foreground, so the earlier handle-only and class-only readings were both flawed; the check is now a pair of criteria with a corrected class read.
- `dsh-plugin.json` no longer declares the unused `messages.observe` capability.

Restart dsh-tui after installing.

## Publishing

- **Repository**: <https://github.com/VviLliAm-qwq/dsh-chime> (public)
- **Release**: `v*` tags drive `.github/workflows/release.yml`, which publishes to npm through **trusted publishing (OIDC)** — no token is stored in the repository.

## License

MIT — see [LICENSE](LICENSE). Sound assets are licensed and attributed in `assets/sounds/CREDITS.md`.
