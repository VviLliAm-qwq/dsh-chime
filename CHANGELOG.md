# Changelog

## 0.3.1 (2026-09-13)

- 文档拆分为中英双版：`README.md` 改为英文（面向 npm / 插件市场的规范形态），中文原文迁入新增的 `README.zh.md`，两版顶部互相链接
- 两版 README 均按公开文档规范改写：去掉人设称呼与内部路径，只描述功能与行为（设置卡片本来就已中英双语，本次未改代码）
- `package.json` 的 `files` 补入 `README.zh.md` 与 `CHANGELOG.md`，避免文档在发布包里缺失

## 0.3.0 (2026-09-12)

- 新增 5 组音效:g5 清亮铃声 / g6 气泡水滴 / g7 街机电子 / g8 木质马林巴 / g9 柔和电子 — 四个设置项的选择列表各新增 5 个选项(g1-g9)
- g5-g9 取自 [Freesound](https://freesound.org) 的 **CC0 1.0** 素材(20 条,每条情景各自一条),按情景语义挑选:完成·聚焦为「完成感」音,完成·未聚焦为更短变体,提问·聚焦为提示答问音,提问·未聚焦为最短提示
- 素材处理链:mpg123(WASM)解码 Freesound 预览 MP3 → 合单声道 → DC 去除 → 按情景裁剪(≤1.25s / 0.75s / 0.95s / 0.60s,截断时淡出 200ms)→ 50ms 短时 RMS 归一至 −6.5 dBFS,超过 −3 dBFS 处软限幅(tanh)→ 48 kHz / 16-bit / 单声道 WAV
- 新增 `assets/sounds/CREDITS.md`:逐条记录采样出处(Freesound 页面链接)、作者与授权,并写明转换参数
- 响度校准:新素材峰值 −3 dBFS、整段 RMS 均值 −14.4 dBFS、50ms 短时 RMS 均值 −9.0 dBFS,与 g1-g4(−14.1 / −8.0)基本一致

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
