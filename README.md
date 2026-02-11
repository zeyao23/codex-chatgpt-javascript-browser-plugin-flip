# E-Ink 点击翻页脚本

这个仓库提供了一个适合墨水屏设备阅读网页的 Userscript：`flip.user.js`。

## 脚本核心逻辑说明

1. **完全禁止 Smooth Scroll**
   - 脚本启动后会强制注入 CSS：
     ```css
     html, body, * {
       scroll-behavior: auto !important;
     }
     ```
   - 这样可覆盖网站自带的平滑滚动（如知乎、简书常见场景），减少墨水屏残影。

2. **点击触发器（Click Trigger）**
   - 点击屏幕 **底部 30% 区域**：向下翻一屏。
   - 点击屏幕 **顶部 30% 区域**：向上翻一屏。
   - 中间 40% 不触发，避免误操作。
   - 使用 `pointerup` 监听，且默认跳过按钮、链接、输入框等可交互元素，尽量不干扰网页正常操作。

3. **重叠区域（Overlap）**
   - 翻页距离 = `window.innerHeight - 40px`。
   - 通过 `40px` 重叠，让上一屏尾部内容在下一屏顶部再出现一次，阅读更连贯。

## 使用方式

将 `flip.user.js` 导入 Tampermonkey / Violentmonkey 等 Userscript 管理器即可。
