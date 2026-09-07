# dsh-chime-sound

dsh-tui 提示音效插件（原名 dsh-notice-sound，2026-09-07 更名）/ Notification sounds for dsh-tui.

- 触发:女仆调用询问模块 `ask_user_question`(`session/event` `tool/call`,提醒主人回来回答问题)与回复完成(`session/event` `turn/end`,agent-loop 每回合仅发一次;`assistant/message` 会随每个工具步骤多次触发,不采用),区分终端聚焦/未聚焦
- 4 组音效(清脆电子 / 木质敲击 / 八比特 / 温馨钢琴)× 4 情景,设置页「提示音效」类中可选择或关闭
- **0.2.0 新增:主音量设置**(设置页「音量 / Volume」项):0%~150%,每档 5%(31 档),默认 100% = 原音量。←/→ 单按 ±5%,**长按连续调节**(dsh-tui 输入层把长按重复展开为逐档事件,无需额外配置);修改后立即试听。>100% 时样本做 16-bit 饱和削波(峰值约 105%,仅极短时段削波;如需无失真可后续改软限幅)。音量仅在插件内部对 WAV 样本增益,不影响系统音量
- 音效由本仓库 `scripts/gen-sounds.mjs` 生成(WAV,16-bit/48kHz)
- 设置与文案支持中英文

## ⚠️ 平台限制（Windows only）

本插件通过 **Win32 API**（koffi → `winmm.dll` `PlaySoundW` / `user32.dll` 焦点检测）播放声音，**仅支持 Windows（Windows Terminal / conhost）**。其他平台（Linux/macOS）上插件静默降级为 no-op（不播放、不拖垮启动），并在日志中给出 `Win32-only` 警告。请勿在非 Windows 环境期待提示音。

## 安装

**方式一（dsh CLI，推荐）：**

```sh
dsh plugin --profile <profile> add dsh-chime-sound
```

（或从 dsh 插件市场 / GitHub 安装：`dsh plugin add github:VviLliAm-qwq/dsh-chime`。）

**方式二（手动，与生态常见流程一致）：**

1. 把插件包复制到 `~/.dsh/profiles/dsh-tui/node_modules/dsh-chime-sound/`
2. 在 `~/.dsh/profiles/dsh-tui/package.json` 的 `dsh.profile.bundles` 追加 `"dsh-chime-sound"`（声明了 `dsh.bundle.patch`，启动时自动挂载）
3. 重启 dsh-tui（`/restart`）生效

**兼容性**：dsh-tui 0.10.x（`ctx.tuiSettingsSections` / `session/event` 软探测接缝）；dsh 0.1.2-rc.1+；Node `^22.19 || >=24`；纯 ESM。配置键均有默认值，缺配置时行为退化为"什么都不发生"。

## 配置

设置项在 dsh-tui 设置页「提示音效 / Notice Sounds」类（或 `~/.dsh/settings.yaml` 的 `chime:` 命名空间）：

```yaml
chime:
  doneFocus: g2   # 完成对话·聚焦时: g1-g4 / off
  doneBlur: g2    # 完成对话·未聚焦时
  askFocus: g2    # 提问·聚焦时
  askBlur: g2     # 提问·未聚焦时
  volume: "50"    # 0-150, 5% 步进, 默认 "100"
```

## 事件源说明(0.1.1 修复)

此前用 dsh-tui 的 mediated `tuiMessageObserver.subscribe()` 订阅消息事件,但该 API 要求插件激活先通过 host admission 绑定已验证的 Component 身份;bundle-patch 挂载的插件不经过 admission,所有订阅被拒绝(`COMPONENT_NOT_ADMITTED`),导致提示音完全不触发。

0.1.1 改用 `@deepseek-ai/dsh-session` 发布的 `session/event` cordis bus 事件(官方 `dsh-working-activity` 扩展同款通道),无需 Component identity:

- `tool/call` 且 `name === 'ask_user_question'` → 提问音(askFocus/askBlur)
- `turn/end` → 完成音(doneFocus/doneBlur),子代理会话不触发
- 焦点判定:GetForegroundWindow 句柄 == GetConsoleWindow 或窗口类名匹配(`CASCADIA_HOSTING_WINDOW_CLASS`=Windows Terminal / `ConsoleWindowClass`=传统 conhost)。ConPTY 下 GetConsoleWindow 返回隐藏的 `PseudoConsoleWindow`(永非前台),旧代码仅按句柄/类名读法均有缺陷,现双判据+修正的类名读取
- `dsh-plugin.json` 已移除不再使用的 `messages.observe` 声明

安装后需重启 dsh-tui 生效。
