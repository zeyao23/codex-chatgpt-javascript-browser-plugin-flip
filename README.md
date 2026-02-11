# E-Ink 点击翻页脚本

这个仓库提供了一个适合墨水屏设备阅读网页的 Userscript：`flip.user.js`。

## 功能概览

1. **完全禁止 Smooth Scroll**
   - 强制注入：
     ```css
     html, body, * {
       scroll-behavior: auto !important;
     }
     ```
   - 避免网站平滑滚动带来的墨水屏残影。

2. **点击翻页（Click Trigger）**
   - 点击底部 30%：向下翻一屏。
   - 点击顶部 30%：向上翻一屏。
   - 翻页时带 `40px` 重叠，阅读不断句。

3. **阅读模式（新增）**
   - 点击右下角“阅读模式”按钮（或按 `R` 键）开启。
   - 开启后会：
     - 移除站点样式（`style` / `link[rel=stylesheet]` / 行内样式）。
     - 自动提取主内容区域（优先 `article/main/[role=main]`，并用文本密度评分）。
     - 仅保留文本与图片并重新排版。
   - 阅读模式状态会写入 `localStorage`，下次打开页面可自动恢复。

## 排版策略（阅读模式）

### 1) 标点禁则（避头尾）

- 通过 `line-break: strict`、`word-break: keep-all`、`hanging-punctuation` 组合，减少中文/日文标点落在不合理位置。
- 段落使用较大的行高与两端对齐（`text-justify: inter-character`）提升墨水屏可读性。

### 2) 不可分割原则

脚本会把以下内容包装为 `white-space: nowrap`，尽量保持同一行：

- 省略号：`......` 与 `……`
- 破折号：`——`
- 数字与单位：如 `100kg`、`20%`、`2026年`
- 英文单词（含撇号）：如 `It's`、`Users'`

### 3) 英文排版

- 英文单词以整体处理，避免在单词内部随机断开。
- 使用 `overflow-wrap: break-word` 作为极端兜底，防止超长 token 溢出。

### 4) 日文排版

- 借助 `line-break: strict` 限制日文促音、小假名、长音符等不合理行首情况。
- 数字与常见单位在脚本中按“不可分割”整体处理。

## 使用方式

将 `flip.user.js` 导入 Tampermonkey / Violentmonkey 等 Userscript 管理器即可。
