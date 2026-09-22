# 会话便签（Session Notes）

CC GUI 插件：给任意会话贴上一张**本地便签**——适合在长会话列表里记录
「这个会话是干什么的 / 进行到哪一步 / 下次要接着做什么」。

## 功能

- **右侧面板「便签」页**：默认跟随当前活动会话，即写即存（500ms 去抖自动保存）。
- **会话右键菜单** →「在便签面板中编辑」：从侧栏任意会话一键定位到它的便签。
- **全部便签列表**：预览 + 引擎 + 更新时间，点击可跨会话查看/编辑，两步确认删除。
- 中/英文界面随宿主语言自动切换；深浅色随宿主主题自动翻转。

## 权限与数据

| 声明权限 | 用途 |
|---|---|
| `storage` | 便签正文与索引存入本插件的隔离 KV（sqlite） |
| `events` | 订阅 `session://activated` 以跟随当前会话 |
| `ui:panel-tab` | 右侧面板「便签」页 |
| `ui:session-menu` | 侧栏会话右键菜单行 |

**数据只留在本机**：插件没有任何网络权限，不外发任何内容。
便签按 `engine + sessionId` 寻址，存于宿主为每个插件隔离的 KV 存储中。

## 从源码构建

```bash
pnpm install
pnpm build      # 产物 main.js / styles.css 输出在仓库根（Obsidian 约定）
pnpm validate   # 本地校验 manifest 与产物
pnpm typecheck
```

本地调试：CC GUI → 设置 → 插件 → 从本地目录安装 → 选择本仓库根目录。

## 发版

```bash
# manifest.json 的 version +1 后，打与 version 完全一致的 tag（无 v 前缀）
git tag 0.1.1 && git push origin 0.1.1
```

GitHub Action 会自动构建并把 `main.js` / `manifest.json` / `styles.css` /
`checksums.txt` 附加到该 tag 的 Release。

## 许可

[MIT](LICENSE)
