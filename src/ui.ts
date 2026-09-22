/**
 * 便签面板：当前会话编辑区 + 全部便签列表。
 * 只用 ctx.react.createElement + hooks（宿主 React 树内渲染，不起第二棵
 * React 树，也不打包任何 React 副本——与官方 token-meter 同款约定）。
 */

import type { PluginContext } from "./ccgui-plugin";
import type { Copy } from "./i18n";
import type { NoteIndexEntry, NotesStore, SessionRef } from "./store";

type H = PluginContext["react"];

/** lucide sticky-note 图标 path 数据手工内联（ISC 许可），禁止 import 三方包。
 *  https://lucide.dev/icons/sticky-note */
function noteIcon(h: H) {
  return h.createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 15,
      height: 15,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    },
    h.createElement("path", {
      d: "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z",
    }),
    h.createElement("path", { d: "M15 3v4a2 2 0 0 0 2 2h4" }),
  );
}

function shortId(sessionId: string): string {
  return sessionId.length <= 12 ? sessionId : `${sessionId.slice(0, 8)}…`;
}

function refKey(ref: SessionRef): string {
  return `${ref.engine}:${ref.sessionId}`;
}

function fmtTime(h: H, ts: number, locale: string): string {
  void h;
  try {
    return new Date(ts).toLocaleString(locale, { hour12: false });
  } catch {
    return new Date(ts).toISOString();
  }
}

export function makeNotesPanel(ctx: PluginContext, store: NotesStore, t: Copy) {
  const h = ctx.react;
  const locale = ctx.host.locale;

  return function SessionNotesPanel() {
    const s = h.useSyncExternalStore(store.subscribe, store.getSnapshot);
    const [confirmKey, setConfirmKey] = h.useState<string | null>(null);

    const header = h.createElement(
      "div",
      { className: "sn-header" },
      noteIcon(h),
      h.createElement(
        "span",
        { className: "sn-header-title" },
        s.editing
          ? `${s.editing.engine} · ${shortId(s.editing.sessionId)}`
          : t.tabLabel,
      ),
      !s.followsActive
        ? h.createElement(
            "button",
            {
              type: "button",
              className: "sn-link-btn",
              onClick: () => store.followActive(),
            },
            t.backToCurrent,
          )
        : null,
    );

    const otherBanner =
      !s.followsActive && s.editing
        ? h.createElement("div", { className: "sn-banner" }, t.editingOther)
        : null;

    const editor = s.editing
      ? h.createElement("textarea", {
          className: "sn-editor",
          value: s.text,
          placeholder: t.placeholder,
          onChange: (e: { target: { value: string } }) => store.setText(e.target.value),
        })
      : h.createElement("div", { className: "sn-empty" }, t.noSession);

    const status =
      s.editing && (s.dirty || s.lastSavedAt !== null)
        ? h.createElement(
            "div",
            { className: "sn-status" },
            s.dirty ? t.saving : `${t.saved} · ${fmtTime(h, s.lastSavedAt ?? 0, locale)}`,
          )
        : null;

    const listRows = s.index.map((entry: NoteIndexEntry) => {
      const key = refKey(entry);
      const confirming = confirmKey === key;
      return h.createElement(
        "div",
        { key, className: "sn-row" },
        h.createElement(
          "button",
          {
            type: "button",
            className: "sn-row-main",
            onClick: () => {
              setConfirmKey(null);
              store.editEntry(entry);
            },
          },
          h.createElement("span", { className: "sn-row-preview" }, entry.preview || "…"),
          h.createElement(
            "span",
            { className: "sn-row-meta" },
            `${entry.engine} · ${fmtTime(h, entry.updatedAt, locale)}`,
          ),
        ),
        confirming
          ? h.createElement(
              "span",
              { className: "sn-row-actions" },
              h.createElement(
                "button",
                {
                  type: "button",
                  className: "sn-danger-btn",
                  onClick: () => {
                    setConfirmKey(null);
                    void store.deleteEntry(entry);
                  },
                },
                t.confirmDel,
              ),
              h.createElement(
                "button",
                {
                  type: "button",
                  className: "sn-link-btn",
                  onClick: () => setConfirmKey(null),
                },
                t.cancel,
              ),
            )
          : h.createElement(
              "button",
              {
                type: "button",
                className: "sn-link-btn",
                "aria-label": `${t.del} ${entry.preview}`,
                onClick: () => setConfirmKey(key),
              },
              t.del,
            ),
      );
    });

    const list = h.createElement(
      "div",
      { className: "sn-list" },
      h.createElement("div", { className: "sn-list-title" }, t.listTitle),
      s.index.length === 0
        ? h.createElement("div", { className: "sn-empty" }, t.emptyList)
        : listRows,
    );

    return h.createElement(
      "div",
      { className: "sn-panel" },
      header,
      otherBanner,
      editor,
      status,
      list,
    );
  };
}
