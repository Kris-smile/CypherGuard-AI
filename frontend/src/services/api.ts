// API Service - 前后端通信层
import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============== Types ==============

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Document {
  id: string;
  owner_user_id: string;
  title: string;
  source_type: 'upload' | 'url';
  source_uri: string;
  mime_type: string;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';
  tags?: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface IngestionTask {
  id: string;
  document_id: string;
  task_type: string;
  celery_task_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  progress: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Mode {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  top_k: number;
  top_n: number;
  min_score: number;
  require_citations: boolean;
  no_evidence_behavior: 'refuse' | 'answer_with_warning';
}

export interface Conversation {
  id: string;
  user_id: string;
  mode_id: string;
  title?: string;
  created_at: string;
}

export interface Citation {
  document_id: string;
  title: string;
  source_type: string;
  source_uri: string;
  chunk_id: string;
  chunk_index: number;
  page_start?: number;
  page_end?: number;
  snippet: string;
  score: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations_json?: Citation[];
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  mode: string;
  trace: {
    top_k: number;
    top_n: number;
    latency_ms: {
      embed: number;
      search: number;
      rerank: number;
      llm: number;
      total: number;
    };
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  model_type: 'embedding' | 'chat' | 'rerank';
  provider: string;
  base_url?: string;
  model_name: string;
  api_key_encrypted?: string;
  is_default: boolean;
  params_json?: Record<string, any>;
  max_concurrency: number;
  rate_limit_rpm?: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelConfigCreate {
  name: string;
  model_type: string;
  provider: string;
  base_url?: string;
  model_name: string;
  api_key: string;
  max_concurrency?: number;
  rate_limit_rpm?: number;
  enabled?: boolean;
}

// ============== Auth API ==============

export const authAPI = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

// ============== KB API ==============

export const kbAPI = {
  uploadDocument: async (file: File, title?: string, tags?: string): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (tags) formData.append('tags', tags);

    const response = await apiClient.post<Document>('/kb/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  listDocuments: async (skip = 0, limit = 100): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>('/kb/documents', {
      params: { skip, limit },
    });
    return response.data;
  },

  getDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.get<Document>(`/kb/documents/${id}`);
    return response.data;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await apiClient.delete(`/kb/documents/${id}`);
  },

  listTasks: async (documentId?: string): Promise<IngestionTask[]> => {
    const response = await apiClient.get<IngestionTask[]>('/kb/tasks', {
      params: documentId ? { document_id: documentId } : {},
    });
    return response.data;
  },
};

// ============== Chat API ==============

export const chatAPI = {
  listModes: async (): Promise<Mode[]> => {
    const response = await apiClient.get<Mode[]>('/chat/modes');
    return response.data;
  },

  createConversation: async (modeName: string, title?: string): Promise<Conversation> => {
    const response = await apiClient.post<Conversation>('/chat/conversations', {
      mode_name: modeName,
      title,
    });
    return response.data;
  },

  listConversations: async (skip = 0, limit = 50): Promise<Conversation[]> => {
    const response = await apiClient.get<Conversation[]>('/chat/conversations', {
      params: { skip, limit },
    });
    return response.data;
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>(`/chat/conversations/${conversationId}/messages`);
    return response.data;
  },

  sendMessage: async (conversationId: string, content: string): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data;
  },
};

// ============== Settings API ==============

export const settingsAPI = {
  // Model Management
  listModels: async (): Promise<ModelConfig[]> => {
    const response = await apiClient.get<ModelConfig[]>('/models');
    return response.data;
  },

  getModel: async (id: string): Promise<ModelConfig> => {
    const response = await apiClient.get<ModelConfig>(`/models/${id}`);
    return response.data;
  },

  createModel: async (data: ModelConfigCreate): Promise<ModelConfig> => {
    const response = await apiClient.post<ModelConfig>('/models', data);
    return response.data;
  },

  updateModel: async (id: string, data: Partial<ModelConfigCreate>): Promise<ModelConfig> => {
    const response = await apiClient.put<ModelConfig>(`/models/${id}`, data);
    return response.data;
  },

  deleteModel: async (id: string): Promise<void> => {
    await apiClient.delete(`/models/${id}`);
  },

  setDefaultModel: async (id: string): Promise<void> => {
    await apiClient.post(`/models/${id}/set-default`);
  },

  testModel: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/models/${id}/test`
    );
    return response.data;
  },

  testOllamaConnection: async (baseUrl: string, modelType: string): Promise<{
    success: boolean;
    message: string;
    models: Array<{ name: string; size: number; modified_at: string }>;
    base_url: string;
  }> => {
    const response = await apiClient.post('/models/test-ollama-connection', {
      base_url: baseUrl,
      model_type: modelType,
    });
    return response.data;
  },
};

export default apiClient;
