import { Platform } from 'react-native';
import api from './api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
} from '../types';

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  verify2faLogin: async (tempToken: string, code: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/2fa-verify', { temp_token: tempToken, code });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<{ message: string; email: string }> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  verifyEmail: async (email: string, code: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/verify-email', { email, code });
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  changeEmail: async (email: string, newEmail: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-email', { email, new_email: newEmail });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: {
    email: string;
    code: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/me');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/me', data);
    return response.data;
  },

  changePassword: async (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> => {
    const response = await api.put('/me/password', data);
    return response.data;
  },

  resetPin: async (): Promise<{ message: string; reset: boolean }> => {
    const response = await api.post('/me/reset-pin', {});
    return response.data;
  },

  uploadAvatar: async (uri: string): Promise<{ avatar: string }> => {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      formData.append('avatar', blob, filename);
    } else {
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('avatar', { uri, name: filename, type } as unknown as Blob);
    }

    const response = await api.post('/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadKyc: async (
    data: {
      type: string;
      city: string;
      address: string;
      idnumber: string;
      idexp: string;
      birthdate: string; // AAAA-MM-JJ
      state: string;     // province / état
      postcode: string;  // code postal
      phone: string;
      country?: string;
      telegram?: string;
      resubmit?: boolean; // re-soumission d'un KYC déjà validé/en attente
    },
    fileUri: string | null,   // null = garder le document déjà uploadé (re-soumission)
    selfieUri: string | null  // null = garder le selfie déjà uploadé
  ): Promise<{ message: string; validate: number }> => {
    const formData = new FormData();
    const appendFile = async (key: string, uri: string) => {
      // Always use a deterministic .jpg filename so October/Laravel's
      // UploadedFile->getClientOriginalExtension() returns a clean ext.
      const filename = `kyc-${key}.jpg`;
      const type = 'image/jpeg';
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        const file = new File([blob], filename, { type });
        formData.append(key, file);
      } else {
        formData.append(key, { uri, name: filename, type } as unknown as Blob);
      }
    };
    // Infos personnelles
    formData.append('type', data.type);
    formData.append('city', data.city);
    formData.append('address', data.address);
    formData.append('idnumber', data.idnumber);
    formData.append('idexp', data.idexp);
    formData.append('birthdate', data.birthdate);
    formData.append('state', data.state);
    formData.append('postcode', data.postcode);
    formData.append('phone', data.phone);
    if (data.country) formData.append('country', data.country);
    if (data.telegram) formData.append('telegram', data.telegram);
    if (data.resubmit) formData.append('resubmit', '1');
    // Fichiers : seulement si l'utilisateur en a (re)pris (sinon on garde l'existant).
    if (fileUri) await appendFile('file', fileUri);
    if (selfieUri) await appendFile('tof', selfieUri);

    const response = await api.post('/me/kyc', formData, {
      headers: Platform.OS === 'web'
        ? { 'Content-Type': undefined as any }
        : { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ─── 2FA ──────────────────────────────────────────────────────────────────

  get2faStatus: async (): Promise<{ enabled: boolean; pending: boolean }> => {
    const response = await api.get('/2fa/status');
    return response.data;
  },

  enable2fa: async (): Promise<{ qr_url: string; qr_svg?: string; secret: string; recovery_codes: string[] }> => {
    const response = await api.post('/2fa/enable');
    return response.data;
  },

  confirm2fa: async (code: string): Promise<{ message: string; recovery_codes: string[] }> => {
    const response = await api.post('/2fa/confirm', { code });
    return response.data;
  },

  disable2fa: async (password: string): Promise<{ message: string }> => {
    const response = await api.post('/2fa/disable', { password });
    return response.data;
  },

  verify2fa: async (code: string): Promise<{ valid: boolean; recovery_used?: boolean }> => {
    const response = await api.post('/2fa/verify', { code });
    return response.data;
  },
};
