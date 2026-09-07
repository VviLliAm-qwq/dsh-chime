# Changelog

## 0.2.0 (2026-09-07)

- 新增主音量设置：0%~150%，5% 步进（31 档），默认 100%（与原音量一致）；设置页「提示音效 → 音量 / Volume」←/→ 单按 ±5%、长按连续调节，修改后立即试听
- 播放链路改为内存增益：新增 `lib/wav.js`（PCM 16-bit 样本增益 + 饱和削波），`PlaySoundW` SND_MEMORY 播放 + 8 槽播放池，>100% 时 16-bit 饱和削波
- 插件改名：`dsh-notice-sound` → `dsh-chime` → npm 发布名 **`dsh-chime-sound`**（manifest id 保持 `com.dsh-tui.chime`，cordis 挂载 id `chime`，设置命名空间 `chime`）
- 非 Windows 平台明确降级：仅 Win32（winmm/user32）可播放，其他平台静默 no-op + 警告日志

## 0.1.1 (2026-09-06)

- 修复事件源：改用 `session/event` cordis bus（无需 host admission），替代被拒的 `tuiMessageObserver.subscribe`
- 焦点判定修正：GetForegroundWindow 句柄 + 窗口类名（CASCADIA_HOSTING_WINDOW_CLASS / ConsoleWindowClass）双判据

## 0.1.0 (2026-09-06)

- 首个版本：完成/提问提示音，4 组音效 × 4 情景，设置页「提示音效」类，中英双语
