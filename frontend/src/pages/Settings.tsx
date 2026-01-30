// Settings Page - 系统设置页面
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Globe, 
  Shield, 
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';
import { settingsAPI, type ModelConfig } from '../services/api';

type SettingsTab = 'general' | 'models' | 'network' | 'system';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('models');

  const tabs = [
    { id: 'general' as SettingsTab, label: '常规设置', icon: SettingsIcon },
    { id: 'models' as SettingsTab, label: '模型管理', icon: Cpu },
    { id: 'network' as SettingsTab, label: '网络设置', icon: Globe },
    { id: 'system' as SettingsTab, label: '系统设置', icon: Shield },
  ];

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Sidebar - Tabs */}
      <div className="w-64 bg-white border-r border-slate-200 p-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-blue-600" />
            系统设置
          </h2>
        </div>

        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'general' && <GeneralSettings key="general" />}
          {activeTab === 'models' && <ModelManagement key="models" />}
          {activeTab === 'network' && <NetworkSettings key="network" />}
          {activeTab === 'system' && <SystemSettings key="system" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// 常规设置
function GeneralSettings() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 max-w-4xl"
    >
      <h3 className="text-2xl font-bold text-slate-900 mb-6">常规设置</h3>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-slate-500">常规设置功能开发中...</p>
      </div>
    </motion.div>
  );
}

// 模型管理
function ModelManagement() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const data = await settingsAPI.listModels();
      setModels(data);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模型配置吗？')) return;
    
    try {
      await settingsAPI.deleteModel(id);
      await loadModels();
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert('删除失败，请重试');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await settingsAPI.setDefaultModel(id);
      await loadModels();
    } catch (error) {
      console.error('Failed to set default model:', error);
      alert('设置默认模型失败');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 max-w-6xl"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-slate-900">模型管理</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          添加模型
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : models.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Cpu className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">还没有配置任何模型</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            立即添加模型 →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onEdit={() => setEditingModel(model)}
              onDelete={() => handleDelete(model.id)}
              onSetDefault={() => handleSetDefault(model.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingModel) && (
          <ModelFormModal
            model={editingModel}
            onClose={() => {
              setShowAddModal(false);
              setEditingModel(null);
            }}
            onSuccess={() => {
              setShowAddModal(false);
              setEditingModel(null);
              loadModels();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 模型卡片
function ModelCard({ 
  model, 
  onEdit, 
  onDelete, 
  onSetDefault 
}: { 
  model: ModelConfig;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const getModelTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      embedding: '向量模型',
      chat: '对话模型',
      rerank: '重排序模型'
    };
    return labels[type] || type;
  };

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      openai: 'OpenAI',
      azure_openai: 'Azure OpenAI',
      anthropic: 'Anthropic',
      cohere: 'Cohere',
      ollama: 'Ollama',
      custom: '自定义'
    };
    return labels[provider] || provider;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold text-slate-900">{model.name}</h4>
            {model.is_default && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                默认
              </span>
            )}
            {!model.enabled && (
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                已禁用
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-slate-500">模型类型</p>
              <p className="text-sm font-medium text-slate-900">{getModelTypeLabel(model.model_type)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">提供商</p>
              <p className="text-sm font-medium text-slate-900">{getProviderLabel(model.provider)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">模型名称</p>
              <p className="text-sm font-medium text-slate-900">{model.model_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">并发数</p>
              <p className="text-sm font-medium text-slate-900">{model.max_concurrency}</p>
            </div>
            {model.rate_limit_rpm && (
              <div>
                <p className="text-sm text-slate-500">速率限制</p>
                <p className="text-sm font-medium text-slate-900">{model.rate_limit_rpm} RPM</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {!model.is_default && (
            <button
              onClick={onSetDefault}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
              title="设为默认"
            >
              <Check className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors group"
            title="编辑"
          >
            <Edit2 className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
            title="删除"
          >
            <Trash2 className="h-5 w-5 text-slate-400 group-hover:text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 模型表单弹窗
function ModelFormModal({ 
  model, 
  onClose, 
  onSuccess 
}: { 
  model: ModelConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
    models?: Array<{ name: string; size: number; modified_at: string }>;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: model?.name || '',
    model_type: model?.model_type || 'chat',
    provider: model?.provider || 'openai',
    base_url: model?.base_url || '',
    model_name: model?.model_name || '',
    api_key: '',
    max_concurrency: model?.max_concurrency || 4,
    rate_limit_rpm: model?.rate_limit_rpm || 60,
    enabled: model?.enabled ?? true,
  });

  // Check if provider is Ollama
  const isOllama = formData.provider === 'ollama';

  // Set default base URL for Ollama
  useEffect(() => {
    if (isOllama && !formData.base_url) {
      setFormData(prev => ({ ...prev, base_url: 'http://localhost:11434' }));
    }
  }, [isOllama]);

  // Test Ollama connection
  const handleTestConnection = async () => {
    if (!formData.base_url) {
      alert('请先填写 Base URL');
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await settingsAPI.testOllamaConnection(
        formData.base_url,
        formData.model_type
      );
      
      setConnectionTestResult(result);
      
      if (result.success && result.models) {
        const modelNames = result.models.map(m => m.name);
        setAvailableModels(modelNames);
        
        // Auto-select first model if none selected
        if (!formData.model_name && modelNames.length > 0) {
          setFormData(prev => ({ ...prev, model_name: modelNames[0] }));
        }
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.response?.data?.detail || '连接测试失败'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate: Ollama doesn't need API key
    if (!isOllama && !model && !formData.api_key) {
      alert('请填写 API Key');
      return;
    }

    setLoading(true);

    try {
      const submitData = { ...formData };
      
      // For Ollama, set a dummy API key if not provided
      if (isOllama && !submitData.api_key) {
        submitData.api_key = 'ollama-no-key-needed';
      }

      if (model) {
        await settingsAPI.updateModel(model.id, submitData);
      } else {
        await settingsAPI.createModel(submitData);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save model:', error);
      alert('保存失败，请检查配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            {model ? '编辑模型' : '添加模型'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">基本信息</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  配置名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例如：GPT-4o Mini"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    模型类型 *
                  </label>
                  <select
                    value={formData.model_type}
                    onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="embedding">向量模型 (Embedding)</option>
                    <option value="chat">对话模型 (Chat)</option>
                    <option value="rerank">重排序模型 (Rerank)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    提供商 *
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="cohere">Cohere</option>
                    <option value="ollama">Ollama</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* API 配置 */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">API 配置</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base URL {isOllama && '*'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required={isOllama}
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={isOllama ? "http://localhost:11434" : "https://api.openai.com/v1"}
                  />
                  {isOllama && (
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !formData.base_url}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          测试连接
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {isOllama ? 'Ollama 服务地址' : '留空使用默认地址'}
                </p>
              </div>

              {/* Connection test result */}
              {connectionTestResult && (
                <div className={cn(
                  "p-4 rounded-lg border flex items-start gap-3",
                  connectionTestResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                )}>
                  {connectionTestResult.success ? (
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      connectionTestResult.success ? "text-green-900" : "text-red-900"
                    )}>
                      {connectionTestResult.message}
                    </p>
                    {connectionTestResult.models && connectionTestResult.models.length > 0 && (
                      <p className="text-xs text-green-700 mt-1">
                        发现模型: {connectionTestResult.models.map(m => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  模型名称 *
                </label>
                {isOllama && availableModels.length > 0 ? (
                  <select
                    required
                    value={formData.model_name}
                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">选择模型</option>
                    {availableModels.map((modelName) => (
                      <option key={modelName} value={modelName}>
                        {modelName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.model_name}
                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={isOllama ? "llama3.2 或 nomic-embed-text" : "gpt-4o-mini"}
                  />
                )}
                {isOllama && availableModels.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    点击"测试连接"自动检测可用模型
                  </p>
                )}
              </div>

              {!isOllama && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    API Key {!model && '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      required={!model}
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={model ? '留空保持不变' : 'sk-...'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 高级设置 */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">高级设置</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  最大并发数
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_concurrency}
                  onChange={(e) => setFormData({ ...formData, max_concurrency: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  速率限制 (RPM)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.rate_limit_rpm}
                  onChange={(e) => setFormData({ ...formData, rate_limit_rpm: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">启用此模型</span>
              </label>
            </div>
          </div>

          {/* 提示信息 */}
          <div className={cn(
            "border rounded-lg p-4 flex gap-3",
            isOllama ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
          )}>
            <AlertCircle className={cn(
              "h-5 w-5 flex-shrink-0 mt-0.5",
              isOllama ? "text-green-600" : "text-blue-600"
            )} />
            <div className="text-sm">
              <p className={cn(
                "font-medium mb-1",
                isOllama ? "text-green-900" : "text-blue-900"
              )}>
                {isOllama ? 'Ollama 本地模型配置' : '配置提示'}
              </p>
              <ul className={cn(
                "list-disc list-inside space-y-1",
                isOllama ? "text-green-800" : "text-blue-800"
              )}>
                {isOllama ? (
                  <>
                    <li>Ollama 是本地运行的模型，无需 API Key</li>
                    <li>确保 Ollama 服务正在运行（默认端口 11434）</li>
                    <li>点击"测试连接"自动检测可用模型</li>
                    <li>Embedding 模型通常包含 "embed" 关键词</li>
                  </>
                ) : (
                  <>
                    <li>API Key 将被加密存储</li>
                    <li>建议根据实际使用情况调整并发数和速率限制</li>
                    <li>不同提供商的 Base URL 格式可能不同</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存配置'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// 网络设置
function NetworkSettings() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 max-w-4xl"
    >
      <h3 className="text-2xl font-bold text-slate-900 mb-6">网络设置</h3>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-slate-500">网络设置功能开发中...</p>
      </div>
    </motion.div>
  );
}

// 系统设置
function SystemSettings() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 max-w-4xl"
    >
      <h3 className="text-2xl font-bold text-slate-900 mb-6">系统设置</h3>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-slate-500">系统设置功能开发中...</p>
      </div>
    </motion.div>
  );
}
