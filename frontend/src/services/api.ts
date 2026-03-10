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

// 响应拦截器 - 401时尝试 refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token: newRefresh } = resp.data;
          localStorage.setItem('access_token', access_token);
          if (newRefresh) localStorage.setItem('refresh_token', newRefresh);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } catch {
          // refresh 也失败，跳转登录
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
  // Support both email and username - the server will check both
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
  refresh_token?: string;
  token_type: string;
  user: User;
}

export interface KnowledgeBaseItem {
  id: string;
  owner_user_id: string;
  name: string;
  tags?: string[];
  kb_type: 'document' | 'faq';
  created_at: string;
  updated_at: string;
  document_count?: number;
  faq_count?: number;
}

export interface KBSearchChunkItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  snippet: string;
  chunk_index: number;
}

export interface KBSearchFAQItem {
  faq_id: string;
  question: string;
  answer: string;
  snippet: string;
}

export interface KBSearchResult {
  chunks: KBSearchChunkItem[];
  faq: KBSearchFAQItem[];
}

export interface Document {
  id: string;
  owner_user_id: string;
  knowledge_base_id?: string | null;
  title: string;
  source_type: 'upload' | 'url';
  source_uri: string;
  mime_type: string;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';
  tags?: string[];
  version: number;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface FAQEntry {
  id: string;
  owner_user_id: string;
  knowledge_base_id?: string | null;
  question: string;
  answer: string;
  similar_questions?: string[];
  tags?: string[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ChunkInfo {
  id: string;
  document_id: string;
  chunk_index: number;
  text?: string;
  text_hash?: string;
  page_start?: number;
  page_end?: number;
  section_title?: string;
  chunk_type: string;
  is_enabled: boolean;
  created_at: string;
}

export interface EntityInfo {
  id: string;
  document_id?: string;
  chunk_id?: string;
  entity_type: string;
  value: string;
  count: number;
  created_at: string;
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
  retrieval_strategy: 'vector' | 'bm25' | 'hybrid';
  bm25_weight: number;
  enable_web_search: boolean;
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
  agent_steps?: Array<{ round: number; llm_output: string; action?: string; observation?: string }>;
  images_json?: string[];
  created_at: string;
  _imagePreviews?: string[];
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
  model_type: 'embedding' | 'chat' | 'vision' | 'document' | 'rerank';
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

  updateProfile: async (data: { username?: string; email?: string }): Promise<User> => {
    const response = await apiClient.put<User>('/auth/profile', data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

// ============== KB API ==============

export const kbAPI = {
  // Knowledge bases
  listKnowledgeBases: async (skip = 0, limit = 100): Promise<KnowledgeBaseItem[]> => {
    const response = await apiClient.get<KnowledgeBaseItem[]>('/kb/knowledge-bases', { params: { skip, limit } });
    return response.data;
  },

  createKnowledgeBase: async (data: { name: string; tags?: string[]; kb_type: 'document' | 'faq' }): Promise<KnowledgeBaseItem> => {
    const response = await apiClient.post<KnowledgeBaseItem>('/kb/knowledge-bases', data);
    return response.data;
  },

  getKnowledgeBase: async (id: string): Promise<KnowledgeBaseItem> => {
    const response = await apiClient.get<KnowledgeBaseItem>(`/kb/knowledge-bases/${id}`);
    return response.data;
  },

  updateKnowledgeBase: async (id: string, data: { name?: string; tags?: string[] }): Promise<KnowledgeBaseItem> => {
    const response = await apiClient.put<KnowledgeBaseItem>(`/kb/knowledge-bases/${id}`, data);
    return response.data;
  },

  deleteKnowledgeBase: async (id: string): Promise<void> => {
    await apiClient.delete(`/kb/knowledge-bases/${id}`);
  },

  searchKnowledgeBase: async (kbId: string, q: string, limit = 20): Promise<KBSearchResult> => {
    const response = await apiClient.get<KBSearchResult>(`/kb/knowledge-bases/${kbId}/search`, { params: { q, limit } });
    return response.data;
  },

  uploadDocument: async (file: File, title?: string, tags?: string, knowledgeBaseId?: string): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (tags) formData.append('tags', tags);
    if (knowledgeBaseId) formData.append('knowledge_base_id', knowledgeBaseId);

    const response = await apiClient.post<Document>('/kb/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  importUrl: async (url: string, title?: string, tags?: string[]): Promise<Document> => {
    const response = await apiClient.post<Document>('/kb/documents/import-url', { url, title, tags });
    return response.data;
  },

  listDocuments: async (skip = 0, limit = 100, knowledgeBaseId?: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>('/kb/documents', { params: { skip, limit, knowledge_base_id: knowledgeBaseId } });
    return response.data;
  },

  getDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.get<Document>(`/kb/documents/${id}`);
    return response.data;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await apiClient.delete(`/kb/documents/${id}`);
  },

  reindexDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.post<Document>(`/kb/documents/${id}/reindex`);
    return response.data;
  },

  listTasks: async (documentId?: string): Promise<IngestionTask[]> => {
    const response = await apiClient.get<IngestionTask[]>('/kb/tasks', {
      params: documentId ? { document_id: documentId } : {},
    });
    return response.data;
  },

  // Chunks
  listChunks: async (documentId: string): Promise<ChunkInfo[]> => {
    const response = await apiClient.get<ChunkInfo[]>(`/kb/documents/${documentId}/chunks`);
    return response.data;
  },

  updateChunk: async (chunkId: string, data: { text?: string; is_enabled?: boolean }): Promise<ChunkInfo> => {
    const response = await apiClient.put<ChunkInfo>(`/kb/chunks/${chunkId}`, data);
    return response.data;
  },

  toggleChunk: async (chunkId: string): Promise<ChunkInfo> => {
    const response = await apiClient.patch<ChunkInfo>(`/kb/chunks/${chunkId}/toggle`);
    return response.data;
  },

  // FAQ
  createFAQ: async (data: { question: string; answer: string; similar_questions?: string[]; tags?: string[]; knowledge_base_id?: string }): Promise<FAQEntry> => {
    const response = await apiClient.post<FAQEntry>('/kb/faq', data);
    return response.data;
  },

  listFAQ: async (skip = 0, limit = 100, knowledgeBaseId?: string): Promise<FAQEntry[]> => {
    const response = await apiClient.get<FAQEntry[]>('/kb/faq', { params: { skip, limit, knowledge_base_id: knowledgeBaseId } });
    return response.data;
  },

  updateFAQ: async (id: string, data: Partial<{ question: string; answer: string; similar_questions: string[]; tags: string[]; is_enabled: boolean }>): Promise<FAQEntry> => {
    const response = await apiClient.put<FAQEntry>(`/kb/faq/${id}`, data);
    return response.data;
  },

  deleteFAQ: async (id: string): Promise<void> => {
    await apiClient.delete(`/kb/faq/${id}`);
  },

  importFAQCSV: async (file: File, knowledgeBaseId?: string): Promise<{ imported: number; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const params = knowledgeBaseId ? { knowledge_base_id: knowledgeBaseId } : {};
    const response = await apiClient.post('/kb/faq/import', formData, {
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Tags
  listTags: async (): Promise<Tag[]> => {
    const response = await apiClient.get<Tag[]>('/kb/tags');
    return response.data;
  },

  createTag: async (name: string, color?: string): Promise<Tag> => {
    const response = await apiClient.post<Tag>('/kb/tags', { name, color: color || '#3B82F6' });
    return response.data;
  },

  deleteTag: async (id: string): Promise<void> => {
    await apiClient.delete(`/kb/tags/${id}`);
  },

  // Entities
  listEntities: async (documentId: string): Promise<EntityInfo[]> => {
    const response = await apiClient.get<EntityInfo[]>(`/kb/documents/${documentId}/entities`);
    return response.data;
  },

  learnDocument: async (id: string): Promise<Document> => {
    try {
      const response = await apiClient.post<Document>(`/kb/documents/${id}/learn`);
      return response.data;
    } catch (error) {
      // Compatibility fallback: older KB service builds expose /reindex but not /learn.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const response = await apiClient.post<Document>(`/kb/documents/${id}/reindex`);
        return response.data;
      }
      throw error;
    }
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

  deleteConversation: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/chat/conversations/${conversationId}`);
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

  sendMessage: async (conversationId: string, content: string, images?: string[], modelConfigId?: string): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/chat/conversations/${conversationId}/messages`,
      { content, images: images?.length ? images : undefined, model_config_id: modelConfigId || undefined }
    );
    return response.data;
  },

  sendMessageStream: async (
    conversationId: string,
    content: string,
    onToken: (token: string) => void,
    onStatus?: (msg: string) => void,
    onDone?: (citations: Citation[]) => void,
    images?: string[],
    modelConfigId?: string,
  ): Promise<void> => {
    const token = localStorage.getItem('access_token');
    const resp = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        images: images?.length ? images : undefined,
        model_config_id: modelConfigId || undefined,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No readable stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') { onDone?.([]); return; }
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'token') onToken(data.content || '');
          else if (data.type === 'status') onStatus?.(data.message || '');
          else if (data.type === 'done') onDone?.(data.citations || []);
        } catch { /* skip parse errors */ }
      }
    }
  },

  sendMessageAgent: async (conversationId: string, content: string, images?: string[], modelConfigId?: string): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(
      `/chat/conversations/${conversationId}/messages/agent`,
      { content, images: images?.length ? images : undefined, model_config_id: modelConfigId || undefined }
    );
    return response.data;
  },
};

// ============== Settings API ==============

export const settingsAPI = {
  listModels: async (): Promise<ModelConfig[]> => {
    const response = await apiClient.get<ModelConfig[]>('/models');
    return response.data;
  },

  listChatModels: async (): Promise<ModelConfig[]> => {
    const models = await settingsAPI.listModels();
    return models.filter(m => m.model_type === 'chat' && m.enabled);
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
    all_models?: Array<{ name: string; size: number; modified_at: string }>;
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
