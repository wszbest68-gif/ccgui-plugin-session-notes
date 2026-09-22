/**
 * 便签存储层：每插件隔离 KV（ctx.storage）上的薄封装。
 *
 * 键布局：
 *   "index"                              → NoteIndexEntry[]（列表页数据源）
 *   "note:<engine>:<sessionId>"          → NoteDoc（正文）
 *   "pendingFocus"                       → 右键菜单写入的待聚焦目标（一次性）
 *
 * 会话 id 无冒号、engine 无冒号，键可安全 split。
 * 状态经 subscribe/getSnapshot 暴露给 useSyncExternalStore，宿主不轮询。
 */

import type { PluginContext } from "./ccgui-plugin";

export interface SessionRef {
  engine: string;
  sessionId: string;
}

export interface NoteIndexEntry extends SessionRef {
  preview: string;
  updatedAt: number;
}

interface NoteDoc {
  text: string;
  updatedAt: number;
}

export interface NotesState {
  /** 初始加载完成前 UI 显示骨架。 */
  loaded: boolean;
  /** 宿主当前活动会话（pending 标签 / 无标签时为 null）。 */
  active: SessionRef | null;
  /** 编辑区目标。 */
  editing: SessionRef | null;
  /** true = editing 跟随活动会话切换；点列表项或右键菜单后为 false。 */
  followsActive: boolean;
  /** 编辑区当前文本。 */
  text: string;
  /** 便签索引，按 updatedAt 降序。 */
  index: NoteIndexEntry[];
  /** 最后一次落盘时刻（null = 未保存过 / 有未落盘更改时由 dirty 区分）。 */
  lastSavedAt: number | null;
  dirty: boolean;
}

const INDEX_KEY = "index";
const PENDING_KEY = "pendingFocus";
const SAVE_DEBOUNCE_MS = 500;

function noteKey(ref: SessionRef): string {
  return `note:${ref.engine}:${ref.sessionId}`;
}

function sameRef(a: SessionRef | null, b: SessionRef | null): boolean {
  if (a === null || b === null) return a === b;
  return a.engine === b.engine && a.sessionId === b.sessionId;
}

function makePreview(text: string): string {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length > 0) return t.slice(0, 60);
  }
  return "";
}

function sortIndex(list: NoteIndexEntry[]): NoteIndexEntry[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export class NotesStore {
  private state: NotesState = {
    loaded: false,
    active: null,
    editing: null,
    followsActive: true,
    text: "",
    index: [],
    lastSavedAt: null,
    dirty: false,
  };

  private readonly listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;

  constructor(private readonly ctx: PluginContext) {}

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  readonly getSnapshot = (): NotesState => this.state;

  private set(patch: Partial<NotesState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** 激活时调用：读索引 + 右键菜单留下的一次性聚焦目标。 */
  async init(): Promise<void> {
    const [index, pending] = await Promise.all([
      this.ctx.storage.get<NoteIndexEntry[]>(INDEX_KEY),
      this.ctx.storage.get<SessionRef & { ts?: number }>(PENDING_KEY),
    ]);
    const list = Array.isArray(index) ? sortIndex(index) : [];
    this.set({ index: list, loaded: true });

    if (pending && typeof pending.engine === "string" && typeof pending.sessionId === "string") {
      await this.ctx.storage.delete(PENDING_KEY);
      this.focusOn({ engine: pending.engine, sessionId: pending.sessionId });
    }
  }

  /** 宿主活动会话切换（session://activated）。 */
  onSessionActivated(data: unknown): void {
    const d = data as { engine?: string | null; sessionId?: string | null } | null;
    const active =
      d && typeof d.engine === "string" && typeof d.sessionId === "string"
        ? { engine: d.engine, sessionId: d.sessionId }
        : null;
    const patch: Partial<NotesState> = { active };
    if (this.state.followsActive && !sameRef(this.state.editing, active)) {
      patch.editing = active;
      this.set(patch);
      void this.loadText(active);
      return;
    }
    this.set(patch);
  }

  /** 右键菜单「在便签面板中编辑」（同窗口经事件直达，跨窗口经 pendingFocus）。 */
  onMenuFocus(ref: SessionRef): void {
    this.focusOn(ref);
  }

  /** 列表项「编辑」。 */
  editEntry(entry: SessionRef): void {
    this.focusOn(entry);
  }

  /** 回到「跟随当前会话」模式。 */
  followActive(): void {
    if (this.state.followsActive) return;
    this.set({ followsActive: true, editing: this.state.active });
    void this.loadText(this.state.active);
  }

  /** 编辑区输入：即时更新状态，去抖落盘。 */
  setText(text: string): void {
    this.set({ text, dirty: true });
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** 删除一条便签（正文 + 索引）；若正在编辑它则清空编辑区。 */
  async deleteEntry(entry: SessionRef): Promise<void> {
    await this.ctx.storage.delete(noteKey(entry));
    const index = this.state.index.filter((e) => !sameRef(e, entry));
    await this.ctx.storage.set(INDEX_KEY, index);
    const patch: Partial<NotesState> = { index };
    if (sameRef(this.state.editing, entry)) {
      patch.text = "";
      patch.dirty = false;
    }
    this.set(patch);
  }

  /** 卸载兜底：尽力把未落盘的更改写出去。 */
  dispose(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.flush();
    }
    this.listeners.clear();
  }

  private focusOn(ref: SessionRef): void {
    this.set({ editing: ref, followsActive: false });
    void this.loadText(ref);
  }

  private async loadText(ref: SessionRef | null): Promise<void> {
    const seq = ++this.loadSeq;
    if (ref === null) {
      this.set({ text: "", dirty: false });
      return;
    }
    const doc = await this.ctx.storage.get<NoteDoc>(noteKey(ref));
    if (seq !== this.loadSeq) return; // 期间用户又切换了目标
    this.set({ text: doc?.text ?? "", dirty: false });
  }

  /** 把编辑区内容落盘；空文本 = 删除该条便签。 */
  private async flush(): Promise<void> {
    const { editing, text } = this.state;
    if (editing === null || !this.state.dirty) return;
    const ref = editing;
    const trimmed = text.trim();
    const now = Date.now();

    let index: NoteIndexEntry[];
    if (trimmed.length === 0) {
      await this.ctx.storage.delete(noteKey(ref));
      index = this.state.index.filter((e) => !sameRef(e, ref));
    } else {
      await this.ctx.storage.set(noteKey(ref), { text, updatedAt: now } satisfies NoteDoc);
      const entry: NoteIndexEntry = { ...ref, preview: makePreview(text), updatedAt: now };
      index = sortIndex([entry, ...this.state.index.filter((e) => !sameRef(e, ref))]);
    }
    await this.ctx.storage.set(INDEX_KEY, index);
    // 用户在落盘期间可能继续输入；只清掉「落盘时没有更脏」的标记。
    if (sameRef(this.state.editing, ref)) {
      this.set({ index, lastSavedAt: now, dirty: false });
    } else {
      this.set({ index });
    }
  }
}
