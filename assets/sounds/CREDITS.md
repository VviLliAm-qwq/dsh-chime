# 音效来源 / Sound Credits

`g1`–`g4` 由本仓库 `scripts/gen-sounds.mjs` 纯代码合成，不含第三方素材。

`g5`–`g9` 取自 [Freesound](https://freesound.org) 的 **CC0 1.0（Creative Commons Zero，公有领域献出）** 素材：CC0 允许任意使用与再分发、无需署名，因此可以随本插件（MIT）一同发布；下表列出出处仅为可追溯与致谢。

转换流程：Freesound 预览 MP3 → mpg123（WASM）解码 → 合单声道 → DC 去除 → 按情景裁剪（完成·聚焦 ≤1.25s、完成·未聚焦 ≤0.75s、提问·聚焦 ≤0.95s、提问·未聚焦 ≤0.60s）→ 淡入 5ms / 淡出 80–200ms（截断时 200ms）→ 50ms 短时 RMS 归一到 −6.5 dBFS、超过 −3 dBFS 处软限幅 → 48 kHz / 16-bit / 单声道 WAV。

## g5 Bell / 清亮铃声

| 文件 | 情景 | 原始音效 | 作者 | 出处 |
|---|---|---|---|---|
| `g5-done-focus.wav` | 完成·聚焦 | Glass Ding / Toast with champagne glasses | Breviceps | [freesound](https://freesound.org/people/Breviceps/sounds/458408) |
| `g5-done-blur.wav` | 完成·未聚焦 | Small Bell | steffcaffrey | [freesound](https://freesound.org/people/steffcaffrey/sounds/452371) |
| `g5-ask-focus.wav` | 提问·聚焦 | Chime Notification | Jofae | [freesound](https://freesound.org/people/Jofae/sounds/380482) |
| `g5-ask-blur.wav` | 提问·未聚焦 | Ding 1 | greenvwbeetle | [freesound](https://freesound.org/people/greenvwbeetle/sounds/241288) |

## g6 Bubble / 气泡水滴

| 文件 | 情景 | 原始音效 | 作者 | 出处 |
|---|---|---|---|---|
| `g6-done-focus.wav` | 完成·聚焦 | bubbles-03.aif | kijjaz | [freesound](https://freesound.org/people/kijjaz/sounds/16738) |
| `g6-done-blur.wav` | 完成·未聚焦 | The Best Bubble Pop Sound For Game and UI | el_boss | [freesound](https://freesound.org/people/el_boss/sounds/669918) |
| `g6-ask-focus.wav` | 提问·聚焦 | bubble sound | Ranner | [freesound](https://freesound.org/people/Ranner/sounds/487532) |
| `g6-ask-blur.wav` | 提问·未聚焦 | Retro, Bubble Shot 01.wav | MATRIXXX_ | [freesound](https://freesound.org/people/MATRIXXX_/sounds/458906) |

## g7 Arcade / 街机电子

| 文件 | 情景 | 原始音效 | 作者 | 出处 |
|---|---|---|---|---|
| `g7-done-focus.wav` | 完成·聚焦 | Retro 'Accomplished' SFX | suntemple | [freesound](https://freesound.org/people/suntemple/sounds/253177) |
| `g7-done-blur.wav` | 完成·未聚焦 | 8-Bit Coin | TheDweebMan | [freesound](https://freesound.org/people/TheDweebMan/sounds/277215) |
| `g7-ask-focus.wav` | 提问·聚焦 | 8-bit Happy Ding | JapanYoshiTheGamer | [freesound](https://freesound.org/people/JapanYoshiTheGamer/sounds/361264) |
| `g7-ask-blur.wav` | 提问·未聚焦 | 8-Bit Text Blip - High Pitch | SomeGuy22 | [freesound](https://freesound.org/people/SomeGuy22/sounds/431328) |

## g8 Marimba / 木质马林巴

| 文件 | 情景 | 原始音效 | 作者 | 出处 |
|---|---|---|---|---|
| `g8-done-focus.wav` | 完成·聚焦 | marimba sequence | PhonosUPF | [freesound](https://freesound.org/people/PhonosUPF/sounds/488154) |
| `g8-done-blur.wav` | 完成·未聚焦 | XYLOPHONE D4.wav | juancamiloorjuela | [freesound](https://freesound.org/people/juancamiloorjuela/sounds/204645) |
| `g8-ask-focus.wav` | 提问·聚焦 | Kalimba C3 | dvdfu | [freesound](https://freesound.org/people/dvdfu/sounds/536549) |
| `g8-ask-blur.wav` | 提问·未聚焦 | Popsicle Stick Pluck | BluetoothBoy | [freesound](https://freesound.org/people/BluetoothBoy/sounds/269335) |

## g9 Soft synth / 柔和电子

| 文件 | 情景 | 原始音效 | 作者 | 出处 |
|---|---|---|---|---|
| `g9-done-focus.wav` | 完成·聚焦 | Beep 03 Positive | PaulMorek | [freesound](https://freesound.org/people/PaulMorek/sounds/330046) |
| `g9-done-blur.wav` | 完成·未聚焦 | Notification | Fupicat | [freesound](https://freesound.org/people/Fupicat/sounds/538149) |
| `g9-ask-focus.wav` | 提问·聚焦 | [UI Sound] Approval - High Pitched Bell Synth | GabFitzgerald | [freesound](https://freesound.org/people/GabFitzgerald/sounds/625174) |
| `g9-ask-blur.wav` | 提问·未聚焦 | Blip or Select | Jofae | [freesound](https://freesound.org/people/Jofae/sounds/379339) |

全部素材均为 CC0 1.0，无署名义务；出处以各 Freesound 原始页面为准。
