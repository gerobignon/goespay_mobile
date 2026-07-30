import { create } from 'zustand';
import type { DevBoard, DevComment, DevStatus, DevTask, DevTaskInput } from '../types';
import { devBoardService } from '../services/devBoardService';

interface DevBoardState {
  board: DevBoard | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Fil de commentaires de la tâche ouverte
  comments: DevComment[];
  commentsTaskId: number | null;
  isLoadingComments: boolean;

  fetchBoard: (silent?: boolean) => Promise<void>;
  markSeen: () => Promise<void>;
  saveTask: (input: DevTaskInput) => Promise<DevTask | null>;
  deleteTask: (id: number) => Promise<void>;
  moveTask: (id: number, status: DevStatus) => Promise<void>;
  archiveTask: (id: number) => Promise<void>;
  sendToTodo: (id: number) => Promise<void>;
  addSubtask: (id: number, label: string) => Promise<void>;
  toggleSubtask: (id: number, index: number) => Promise<void>;

  fetchComments: (taskId: number) => Promise<void>;
  addComment: (taskId: number, body: string, quote?: string, quoteId?: number) => Promise<void>;
  updateComment: (id: number, body: string) => Promise<void>;

  reset: () => void;
}

/**
 * Badge de notif (miroir de la sidebar /admin) : commentaires non lus
 * + nouvelles tâches créées par un autre depuis la dernière visite du board.
 */
export function selectDevUnread(state: DevBoardState): number {
  const b = state.board;
  if (!b) return 0;
  let n = b.counts?.new_tasks || 0;
  for (const list of Object.values(b.tasks_by_status)) {
    for (const task of list) n += task.unread_count || 0;
  }
  for (const task of b.backlog) n += task.unread_count || 0;
  return n;
}

/** Applique une transformation à une tâche partout où elle se trouve (colonnes + backlog). */
function mapTask(board: DevBoard, id: number, fn: (t: DevTask) => DevTask): DevBoard {
  const tasks_by_status: Record<string, DevTask[]> = {};
  for (const [key, list] of Object.entries(board.tasks_by_status)) {
    tasks_by_status[key] = list.map((t) => (t.id === id ? fn(t) : t));
  }
  const backlog = board.backlog.map((t) => (t.id === id ? fn(t) : t));
  return { ...board, tasks_by_status, backlog };
}

export const useDevBoardStore = create<DevBoardState>((set, get) => ({
  board: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  comments: [],
  commentsTaskId: null,
  isLoadingComments: false,

  fetchBoard: async (silent = false) => {
    set(silent ? { isRefreshing: true } : { isLoading: true, error: null });
    try {
      const board = await devBoardService.getBoard();
      set({ board, isLoading: false, isRefreshing: false, error: null });
    } catch (e: any) {
      set({
        isLoading: false,
        isRefreshing: false,
        error: e?.response?.data?.error || 'Chargement impossible.',
      });
    }
  },

  markSeen: async () => {
    // Efface immédiatement la part « nouvelles tâches » du badge, puis persiste.
    const board = get().board;
    if (board) {
      set({ board: { ...board, counts: { ...board.counts, new_tasks: 0 } } });
    }
    try {
      await devBoardService.markSeen();
    } catch {
      // ignore : le badge se resynchronisera au prochain fetch
    }
  },

  saveTask: async (input) => {
    const { task } = await devBoardService.saveTask(input);
    await get().fetchBoard(true);
    return task ?? null;
  },

  deleteTask: async (id) => {
    await devBoardService.deleteTask(id);
    await get().fetchBoard(true);
  },

  moveTask: async (id, status) => {
    // Optimiste : déplace la carte immédiatement, puis synchronise.
    const board = get().board;
    if (board) {
      let moved: DevTask | undefined;
      const from: Record<string, DevTask[]> = {};
      for (const [key, list] of Object.entries(board.tasks_by_status)) {
        from[key] = list.filter((t) => {
          if (t.id === id) { moved = t; return false; }
          return true;
        });
      }
      let backlog = board.backlog.filter((t) => {
        if (t.id === id) { moved = t; return false; }
        return true;
      });
      if (moved) {
        const next = { ...moved, status };
        if (status === 'later') {
          backlog = [next, ...backlog];
        } else {
          from[status] = [...(from[status] || []), next];
        }
        set({ board: { ...board, tasks_by_status: from, backlog } });
      }
    }
    try {
      await devBoardService.moveTask(id, status);
    } finally {
      await get().fetchBoard(true);
    }
  },

  archiveTask: async (id) => {
    await devBoardService.archiveTask(id);
    await get().fetchBoard(true);
  },

  sendToTodo: async (id) => {
    await devBoardService.sendToTodo(id);
    await get().fetchBoard(true);
  },

  addSubtask: async (id, label) => {
    const { subtasks } = await devBoardService.addSubtask(id, label);
    const board = get().board;
    if (board) {
      set({
        board: mapTask(board, id, (t) => ({
          ...t,
          subtasks,
          subtask_stats: { total: subtasks.length, done: subtasks.filter((s) => s.done).length },
        })),
      });
    }
  },

  toggleSubtask: async (id, index) => {
    // Optimiste
    const board = get().board;
    if (board) {
      set({
        board: mapTask(board, id, (t) => {
          const subtasks = t.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
          return { ...t, subtasks, subtask_stats: { total: subtasks.length, done: subtasks.filter((s) => s.done).length } };
        }),
      });
    }
    try {
      const { subtasks } = await devBoardService.toggleSubtask(id, index);
      const b2 = get().board;
      if (b2) {
        set({
          board: mapTask(b2, id, (t) => ({
            ...t,
            subtasks,
            subtask_stats: { total: subtasks.length, done: subtasks.filter((s) => s.done).length },
          })),
        });
      }
    } catch {
      await get().fetchBoard(true);
    }
  },

  fetchComments: async (taskId) => {
    set({ isLoadingComments: true, commentsTaskId: taskId });
    try {
      const comments = await devBoardService.getComments(taskId);
      set({ comments, isLoadingComments: false });
      // Ouvrir le fil = tout lire → efface le badge non-lu de la carte.
      const board = get().board;
      if (board) {
        set({ board: mapTask(board, taskId, (t) => ({ ...t, unread_count: 0 })) });
      }
    } catch {
      set({ isLoadingComments: false });
    }
  },

  addComment: async (taskId, body, quote, quoteId) => {
    const comments = await devBoardService.addComment(taskId, body, quote, quoteId);
    set({ comments });
    const board = get().board;
    if (board) {
      set({
        board: mapTask(board, taskId, (t) => ({
          ...t,
          comments_count: comments.length,
          unread_count: 0,
        })),
      });
    }
  },

  updateComment: async (id, body) => {
    const taskId = get().commentsTaskId;
    const comments = await devBoardService.updateComment(id, body);
    set({ comments });
    if (taskId) {
      const board = get().board;
      if (board) set({ board: mapTask(board, taskId, (t) => ({ ...t, comments_count: comments.length })) });
    }
  },

  reset: () => set({ board: null, comments: [], commentsTaskId: null, error: null }),
}));
