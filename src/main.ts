// 样式入口：宿主加载 main.js 时自动注入根 styles.css（vite 构建产物）；
// 这里 import 让 vite 把 src/styles.css 收进产物。
import "./styles.css";

import type { PluginActivate } from "./ccgui-plugin";
import { copy } from "./i18n";
import { NotesStore, type SessionRef } from "./store";
import { makeNotesPanel } from "./ui";

/** 插件内事件前缀约定（宿主只允许 "plugin:<id>:" 前缀的 emit）。 */
const FOCUS_TOPIC = "plugin:session-notes:focus";
const PENDING_KEY = "pendingFocus";

const activate: PluginActivate = (ctx) => {
  const t = copy(ctx.host.locale);
  const store = new NotesStore(ctx);
  void store.init();

  // 活动会话切换 → 面板默认跟随（用户手动锁定其他会话时除外）。
  ctx.events.on("session://activated", (data) => store.onSessionActivated(data));
  // 右键菜单 → 同窗口面板即时聚焦。
  ctx.events.on(FOCUS_TOPIC, (data) => store.onMenuFocus(data as SessionRef));

  ctx.ui.registerPanelTab({
    key: "session-notes",
    label: () => t.tabLabel,
    component: makeNotesPanel(ctx, store, t),
  });

  // 侧栏会话右键菜单行：记录目标并通知面板；面板未挂载时由 init()
  // 读取 pendingFocus 兜底（跨窗口/冷启动场景）。
  ctx.ui.registerSessionMenuItem({
    key: "session-notes.edit",
    label: () => t.menuLabel,
    run: (target) => {
      const ref: SessionRef & { ts: number } = {
        engine: target.engine,
        sessionId: target.sessionId,
        ts: Date.now(),
      };
      void ctx.storage.set(PENDING_KEY, ref);
      ctx.events.emit(FOCUS_TOPIC, { engine: ref.engine, sessionId: ref.sessionId });
    },
  });

  return () => store.dispose();
};

export default activate;
