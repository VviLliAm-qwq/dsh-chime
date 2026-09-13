# dsh-chime-sound

**中文** · [English](README.md)

dsh-tui 提示音效插件（原名 dsh-notice-sound，2026-09-07 更名）。

- 触发：代理调用询问模块 `ask_user_question`（`session/event` `tool/call`，提醒用户回来回答问题）与回复完成（`session/event` `turn/end`，agent-loop 每回合仅发一次；`assistant/message` 会随每个工具步骤多次触发，不采用），并区分终端聚焦 / 未聚焦。
- 9 组音效 × 4 情景，设置页「提示音效」类中可选择或关闭：g1 清脆电子 / g2 木质敲击 / g3 八比特 / g4 温馨钢琴（代码合成），g5 清亮铃声 / g6 气泡水滴 / g7 街机电子 / g8 木质马林巴 / g9 柔和电子（CC0 采样）。
- **0.2.0 新增：主音量设置**（设置页「音量 / Volume」项）：0%~150%，每档 5%（31 档），默认 100% = 原音量。`←/→` 单按 ±5%，**长按连续调节**（dsh-tui 输入层把长按重复展开为逐档事件，无需额外配置）；修改后立即试听。>100% 时样本做 16-bit 饱和削波（峰值约 105%，仅极短时段削波）。音量只在插件内部对 WAV 样本增益，不影响系统音量。
- g1-g4 由本仓库 `scripts/gen-sounds.mjs` 合成（WAV，16-bit / 48 kHz）；g5-g9 为 [Freesound](https://freesound.org) **CC0 1.0** 素材，解码后裁剪、淡入淡出、响度校准为同规格 WAV，出处与转换参数见 `assets/sounds/CREDITS.md`（CC0 无需署名、可随本插件再分发）。
- 设置与文案均支持中英文；界面语言跟随 dsh-tui 的 `/lang`（设置卡片的文案由宿主按当前语言渲染）。

## ⚠️ 平台限制（Windows only）

本插件通过 **Win32 API**（koffi → `winmm.dll` `PlaySoundW` / `user32.dll` 焦点检测）播放声音，**仅支持 Windows（Windows Terminal / conhost）**。其他平台（Linux / macOS）上插件静默降级为 no-op（不播放、不拖垮启动），并在日志中给出 `Win32-only` 警告。请勿在非 Windows 环境期待提示音。

## 安装

**方式一（dsh CLI，推荐）：**

```sh
dsh plugin --profile <profile> add dsh-chime-sound
```

（或从 dsh 插件市场 / GitHub 安装：`dsh plugin add github:VviLliAm-qwq/dsh-chime`。）

**方式二（手动）：**

1. 把插件包复制到 `~/.dsh/profiles/dsh-tui/node_modules/dsh-chime-sound/`
2. 在 `~/.dsh/profiles/dsh-tui/package.json` 的 `dsh.profile.bundles` 追加 `"dsh-chime-sound"`（该包声明了 `dsh.bundle.patch`，启动时自动挂载）
3. 重启 dsh-tui（`/restart`）生效

**兼容性**：dsh-tui 0.10.x（`ctx.tuiSettingsSections` / `session/event` 软探测接缝）；dsh 0.1.2-rc.1+；Node `^22.19 || >=24`；纯 ESM。配置键均有默认值，缺配置时行为退化为「什么都不发生」。

## 配置

设置项在 dsh-tui 设置页「提示音效 / Notice Sounds」类（或 `~/.dsh/settings.yaml` 的 `chime:` 命名空间）：

```yaml
chime:
  doneFocus: g2   # 完成对话·聚焦时: g1-g9 / off
  doneBlur: g2    # 完成对话·未聚焦时
  askFocus: g2    # 提问·聚焦时
  askBlur: g2     # 提问·未聚焦时
  volume: "50"    # 0-150, 5% 步进, 默认 "100"
```

## 事件源说明

dsh-tui 的 mediated `tuiMessageObserver.subscribe()` 对本插件不可用：该 API 要求插件激活先通过 host admission 绑定已验证的 Component 身份，bundle-patch 挂载的插件不经过 admission，订阅会被拒绝（`COMPONENT_NOT_ADMITTED`），提示音完全不触发。

改用 `@deepseek-ai/dsh-session` 发布的 `session/event` cordis bus 事件（官方 `dsh-working-activity` 扩展同款通道），无需 Component identity：

- `tool/call` 且 `name === 'ask_user_question'` → 提问音（askFocus / askBlur）
- `turn/end` → 完成音（doneFocus / doneBlur），子代理会话不触发
- 焦点判定：`GetForegroundWindow` 句柄 == `GetConsoleWindow`，或窗口类名匹配（`CASCADIA_HOSTING_WINDOW_CLASS` = Windows Terminal / `ConsoleWindowClass` = 传统 conhost）。ConPTY 下 `GetConsoleWindow` 返回隐藏的 `PseudoConsoleWindow`（永非前台），旧代码仅按句柄或仅按类名读取都有缺陷，现为双判据 + 修正的类名读取
- `dsh-plugin.json` 已移除不再使用的 `messages.observe` 声明

安装后需重启 dsh-tui 生效。

## 发布

- **仓库**：<https://github.com/VviLliAm-qwq/dsh-chime>（公开）

## 许可

MIT — 见 [LICENSE](LICENSE)。音效素材的授权与出处见 `assets/sounds/CREDITS.md`。
