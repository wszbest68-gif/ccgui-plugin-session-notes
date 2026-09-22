/** 文案插件自带，按 ctx.host.locale 切换 zh/en（与官方 token-meter 同款约定）。 */

export interface Copy {
  tabLabel: string;
  menuLabel: string;
  noSession: string;
  placeholder: string;
  backToCurrent: string;
  editingOther: string;
  listTitle: string;
  emptyList: string;
  edit: string;
  del: string;
  confirmDel: string;
  cancel: string;
  saved: string;
  saving: string;
  sessionFallback: string;
}

const ZH: Copy = {
  tabLabel: "便签",
  menuLabel: "在便签面板中编辑",
  noSession: "当前没有活动会话。打开一个会话，或从下方列表选择一条便签。",
  placeholder: "给这个会话写点什么…… 自动保存，仅存本机。",
  backToCurrent: "回到当前会话",
  editingOther: "正在编辑其他会话的便签",
  listTitle: "全部便签",
  emptyList: "还没有便签。在当前会话的上方输入框写下第一条吧。",
  edit: "编辑",
  del: "删除",
  confirmDel: "确认删除？",
  cancel: "取消",
  saved: "已保存",
  saving: "保存中…",
  sessionFallback: "未命名会话",
};

const EN: Copy = {
  tabLabel: "Notes",
  menuLabel: "Edit in Notes panel",
  noSession: "No active session. Open a session, or pick a note from the list below.",
  placeholder: "Write a note for this session… Auto-saved, stored locally only.",
  backToCurrent: "Back to current session",
  editingOther: "Editing a note of another session",
  listTitle: "All notes",
  emptyList: "No notes yet. Write your first one above for the current session.",
  edit: "Edit",
  del: "Delete",
  confirmDel: "Delete?",
  cancel: "Cancel",
  saved: "Saved",
  saving: "Saving…",
  sessionFallback: "Untitled session",
};

export function copy(locale: string): Copy {
  return locale.startsWith("zh") ? ZH : EN;
}
