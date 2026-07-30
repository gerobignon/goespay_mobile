import { Platform } from 'react-native';
import api from './api';
import type { DevBoard, DevComment, DevTask, DevTaskInput, DevSubtask } from '../types';

/**
 * API du board Kanban Dev (admin) — miroir de la page backend /admin/dev.
 * Toutes les routes sont sous `/admin/dev` et réservées au groupe admin.
 */
export const devBoardService = {
  getBoard: async (): Promise<DevBoard> => {
    const { data } = await api.get<DevBoard>('/admin/dev/board');
    return data;
  },

  /** Crée ou met à jour une tâche. Utilise multipart si une image est jointe/retirée. */
  saveTask: async (input: DevTaskInput): Promise<{ task: DevTask }> => {
    const hasFile = !!input.imageUri;
    const hasImageOp = hasFile || input.removeImage;

    if (!hasImageOp) {
      const { data } = await api.post<{ task: DevTask }>('/admin/dev/tasks', {
        id: input.id,
        title: input.title,
        description: input.description ?? '',
        status: input.status,
        priority: input.priority,
        category: input.category ?? '',
        platform: input.platform ?? '',
        assigned_to: input.assigned_to ?? '',
        due_date: input.due_date ?? '',
        subtasks: input.subtasks ?? [],
      });
      return data;
    }

    // Multipart (pièce jointe)
    const form = new FormData();
    if (input.id) form.append('id', String(input.id));
    form.append('title', input.title);
    form.append('description', input.description ?? '');
    form.append('status', input.status);
    form.append('priority', input.priority);
    form.append('category', input.category ?? '');
    form.append('platform', input.platform ?? '');
    form.append('assigned_to', input.assigned_to != null ? String(input.assigned_to) : '');
    form.append('due_date', input.due_date ?? '');
    form.append('subtasks', JSON.stringify(input.subtasks ?? []));
    if (input.removeImage) form.append('remove_image', '1');
    if (input.imageUri) {
      const uri = input.imageUri;
      const filename = uri.split('/').pop() || 'task.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      if (Platform.OS === 'web') {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        form.append('image', blob, filename);
      } else {
        form.append('image', { uri, name: filename, type } as unknown as Blob);
      }
    }

    const { data } = await api.post<{ task: DevTask }>('/admin/dev/tasks', form, {
      headers: Platform.OS === 'web'
        ? { 'Content-Type': undefined as any }
        : { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  markSeen: async (): Promise<void> => {
    await api.post('/admin/dev/seen');
  },

  deleteTask: async (id: number): Promise<void> => {
    await api.delete(`/admin/dev/tasks/${id}`);
  },

  moveTask: async (id: number, status: string, order?: number[]): Promise<void> => {
    await api.post(`/admin/dev/tasks/${id}/move`, { status, order });
  },

  archiveTask: async (id: number): Promise<{ archived_count: number }> => {
    const { data } = await api.post(`/admin/dev/tasks/${id}/archive`);
    return data;
  },

  sendToTodo: async (id: number): Promise<void> => {
    await api.post(`/admin/dev/tasks/${id}/send-to-todo`);
  },

  addSubtask: async (id: number, label: string): Promise<{ subtasks: DevSubtask[] }> => {
    const { data } = await api.post(`/admin/dev/tasks/${id}/subtasks`, { label });
    return data;
  },

  toggleSubtask: async (id: number, index: number): Promise<{ done: boolean; subtasks: DevSubtask[] }> => {
    const { data } = await api.post(`/admin/dev/tasks/${id}/subtasks/toggle`, { index });
    return data;
  },

  getComments: async (taskId: number): Promise<DevComment[]> => {
    const { data } = await api.get<{ comments: DevComment[] }>(`/admin/dev/tasks/${taskId}/comments`);
    return data.comments;
  },

  addComment: async (
    taskId: number,
    body: string,
    quote?: string,
    quoteId?: number,
  ): Promise<DevComment[]> => {
    const { data } = await api.post<{ comments: DevComment[] }>(
      `/admin/dev/tasks/${taskId}/comments`,
      { body, quote: quote ?? '', quote_id: quoteId ?? 0 },
    );
    return data.comments;
  },

  updateComment: async (id: number, body: string): Promise<DevComment[]> => {
    const { data } = await api.put<{ comments: DevComment[] }>(`/admin/dev/comments/${id}`, { body });
    return data.comments;
  },

  saveCategories: async (
    categories: { key?: string; label: string; color: string }[],
  ): Promise<{ categories: Record<string, { label: string; color: string }> }> => {
    const { data } = await api.post('/admin/dev/categories', { categories });
    return data;
  },
};
