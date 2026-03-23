import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Globe,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ChevronDown,
  Server,
  Users,
  Key,
  Info,
  Star,
  MoreVertical,
  Wrench,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';
import { settingsAPI, type ModelConfig } from '../services/api';
import { SettingItem } from '../components/settings/SettingItem';
import { SettingsSection } from '../components/settings/SettingsSection';

// ============== Types & Constants ==============

type SettingsTab =
  | 'general'
  | 'models-llm'
  | 'models-embedding'
  | 'models-rerank'
  | 'models-vision'
  | 'ollama'
  | 'web-search'
  | 'mcp'
  | 'system'
  | 'tenant'
  | 'api-info';

const MODEL_TABS: SettingsTab[] = [
  'models-llm',
  'models-embedding',
  'models-rerank',
  'models-vision',
];
const isModelTab = (tab: string): boolean =>
  MODEL_TABS.includes(tab as SettingsTab);

const MODEL_TAB_TO_TYPE: Record<string, string> = {
  'models-llm': 'chat',
  'models-embedding': 'embedding',
  'models-rerank': 'rerank',
  'models-vision': 'vision',
};

interface ModelSection {
  type: string;
  title: string;
  subtitle: string;
}

const MODEL_SECTIONS: ModelSection[] = [
  { type: 'chat', title: '对话模型', subtitle: '配置用于对话的大语言模型' },
  {
    type: 'embedding',
    title: 'Embedding 模型',
    subtitle: '配置用于文本向量化的嵌入模型',
  },
  {
    type: 'rerank',
    title: 'ReRank 模型',
    subtitle: '配置用于结果重排序的模型',
  },
  {
    type: 'vision',
    title: 'VLLM 视觉模型',
    subtitle: '配置用于视觉理解和多模态的视觉语言模型',
  },
];

const MODEL_TYPE_SUBTITLES: Record<string, string> = {
  chat: '配置用于对话的大语言模型',
  embedding: '配置用于文本向量化的嵌入模型',
  rerank: '配置用于结果重排序的模型',
  vision: '配置用于视觉理解和多模态的视觉语言模型',
  document: '配置用于文档分析的模型',
};

const PROVIDER_BADGES: Record<string, { label: string; className: string }> = {
  ollama: { label: 'Ollama', className: 'bg-emerald-100 text-emerald-700' },
  openai: { label: 'OpenAI', className: 'bg-slate-100 text-slate-700' },
  azure_openai: {
    label: 'Azure OpenAI',
    className: 'bg-blue-100 text-blue-700',
  },
  anthropic: { label: 'Anthropic', className: 'bg-amber-100 text-amber-700' },
  cohere: { label: 'Cohere', className: 'bg-purple-100 text-purple-700' },
  custom: { label: 'Remote', className: 'bg-slate-100 text-slate-600' },
};

// ============== Main Component ==============

interface SettingsProps {
  onClose?: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('models-llm');
  const [modelsExpanded, setModelsExpanded] = useState(true);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModelType, setAddModelType] = useState<string>('chat');
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    }
  };

  const handleAddModel = (modelType: string) => {
    setAddModelType(modelType);
    setShowAddModal(true);
  };

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (isModelTab(tab)) {
      setModelsExpanded(true);
      const sectionType = MODEL_TAB_TO_TYPE[tab];
      if (sectionType) {
        setTimeout(() => {
          sectionRefs.current[sectionType]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 50);
      }
    }
  };

  const modelSubItems: { id: SettingsTab; label: string }[] = [
    { id: 'models-llm', label: 'LLM模型' },
    { id: 'models-embedding', label: '嵌入模型' },
    { id: 'models-rerank', label: '重排序模型' },
    { id: 'models-vision', label: '多模态模型' },
  ];

  const otherNavItems: {
    id: SettingsTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: 'ollama', label: 'Ollama', icon: Server },
    { id: 'web-search', label: '网络搜索', icon: Globe },
    { id: 'mcp', label: 'MCP服务', icon: Wrench },
    { id: 'system', label: '系统设置', icon: Info },
    { id: 'tenant', label: '租户信息', icon: Users },
    { id: 'api-info', label: 'API信息', icon: Key },
  ];

  const ollamaBaseUrl =
    models.find((m) => m.provider === 'ollama' && m.base_url)?.base_url ||
    'http://host.docker.internal:11434';

  const renderContent = () => {
    if (isModelTab(activeTab)) {
      return (
        <ModelManagementContent
          models={models}
          loading={loading}
          onAddModel={handleAddModel}
          onEditModel={setEditingModel}
          onDeleteModel={handleDelete}
          onSetDefault={handleSetDefault}
          sectionRefs={sectionRefs}
        />
      );
    }

    if (activeTab === 'ollama') {
      return <OllamaSettings baseUrl={ollamaBaseUrl} />;
    }

    if (activeTab === 'system') {
      return <SystemSettingsStatusContent />;
    }

    const tabLabels: Record<string, string> = {
      general: '常规设置',
      'web-search': '网络搜索',
      mcp: 'MCP 服务',
      system: '系统设置',
      tenant: '租户信息',
      'api-info': 'API 信息',
    };

    return (
      <div className="p-8 max-w-4xl">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">
          {tabLabels[activeTab]}
        </h3>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <SettingsIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">
            {tabLabels[activeTab]}功能开发中...
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Sidebar */}
      <div className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">设置</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5">
          <SidebarItem
            icon={SettingsIcon}
            label="常规设置"
            isActive={activeTab === 'general'}
            onClick={() => handleTabChange('general')}
          />

          {/* 模型管理 - Expandable */}
          <div>
            <button
              onClick={() => {
                if (!modelsExpanded) {
                  setModelsExpanded(true);
                  handleTabChange('models-llm');
                } else {
                  setModelsExpanded(false);
                }
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left text-sm',
                isModelTab(activeTab)
                  ? 'text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Cpu
                className={cn(
                  'h-[18px] w-[18px] flex-shrink-0',
                  isModelTab(activeTab) ? 'text-blue-600' : 'text-slate-400'
                )}
              />
              <span className="flex-1">模型管理</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform text-slate-400',
                  !modelsExpanded && '-rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {modelsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-[22px] pl-3 border-l-2 border-slate-200 py-1 space-y-0.5">
                    {modelSubItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                          activeTab === item.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {otherNavItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.id}
              onClick={() => handleTabChange(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 z-10 p-2 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={isModelTab(activeTab) ? 'models' : activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingModel) && (
          <ModelFormModal
            model={editingModel}
            defaultModelType={addModelType}
            ollamaBaseUrl={ollamaBaseUrl}
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
    </div>
  );
}

// ============== Sidebar Item ==============

function SystemSettingsStatusContent() {
  return (
    <div className="max-w-5xl space-y-8 p-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">系统设置</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              这里集中展示系统级能力的开发进度，便于后续继续扩展主题模式、联网搜索和插件系统。
            </p>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Module Status
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">3 tracked features</p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="功能状态"
        description="已完成、开发中和待上线能力采用统一状态徽标，方便后续继续接入更多系统模块。"
      >
        <SettingItem
          title="主题模式"
          description="当前系统主题样式已经完成，可作为后续外观切换能力的基础。"
          status="completed"
          icon={<SettingsIcon className="h-4 w-4" />}
        />
        <SettingItem
          title="联网搜索"
          description="正在持续完善搜索接入、结果整合和引用展示链路。"
          status="developing"
          icon={<Globe className="h-4 w-4" />}
        />
        <SettingItem
          title="插件系统"
          description="预留扩展位，后续将支持插件接入、安装和生命周期管理。"
          status="coming_soon"
          icon={<Wrench className="h-4 w-4" />}
        />
      </SettingsSection>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left text-sm',
        isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-slate-600 hover:bg-slate-50'
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] flex-shrink-0',
          isActive ? 'text-blue-600' : 'text-slate-400'
        )}
      />
      <span>{label}</span>
    </button>
  );
}

// ============== Model Management Content ==============

function ModelManagementContent({
  models,
  loading,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onSetDefault,
  sectionRefs,
}: {
  models: ModelConfig[];
  loading: boolean;
  onAddModel: (type: string) => void;
  onEditModel: (model: ModelConfig) => void;
  onDeleteModel: (id: string) => void;
  onSetDefault: (id: string) => void;
  sectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl space-y-10">
      {MODEL_SECTIONS.map((section) => {
        const sectionModels = models.filter(
          (m) => m.model_type === section.type
        );

        return (
          <div
            key={section.type}
            ref={(el) => {
              sectionRefs.current[section.type] = el;
            }}
            className="scroll-mt-8"
          >
            {/* Section Header */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {section.title}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {section.subtitle}
                </p>
              </div>
              <button
                onClick={() => onAddModel(section.type)}
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                添加模型
              </button>
            </div>

            {/* Model Cards */}
            <div className="mt-4 space-y-3">
              {sectionModels.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 py-10 text-center">
                  <p className="text-sm text-slate-400">
                    暂无 {section.title}
                  </p>
                </div>
              ) : (
                sectionModels.map((model) => (
                  <ModelItemCard
                    key={model.id}
                    model={model}
                    onEdit={() => onEditModel(model)}
                    onDelete={() => onDeleteModel(model.id)}
                    onSetDefault={() => onSetDefault(model.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============== Model Item Card ==============

function ModelItemCard({
  model,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  model: ModelConfig;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const badge = PROVIDER_BADGES[model.provider] || {
    label: model.provider,
    className: 'bg-slate-100 text-slate-600',
  };

  const vectorDimension = model.params_json?.vector_dimension;

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-blue-300 transition-all group relative">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-slate-900 truncate">
              {model.model_name}
            </h4>
            {model.is_default && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-200 flex-shrink-0">
                <Star className="h-3 w-3" />
                默认
              </span>
            )}
            {!model.enabled && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full flex-shrink-0">
                已禁用
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={cn(
                'px-2.5 py-0.5 rounded text-xs font-medium',
                badge.className
              )}
            >
              {badge.label}
            </span>
            {vectorDimension && (
              <span className="text-xs text-slate-400">
                向量维度: {vectorDimension}
              </span>
            )}
            {model.name !== model.model_name && (
              <span className="text-xs text-slate-400 truncate max-w-[200px]">
                {model.name}
              </span>
            )}
          </div>
        </div>

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              menuOpen
                ? 'bg-slate-100 text-slate-600'
                : 'opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400'
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[140px]"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  编辑
                </button>
                {!model.is_default && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSetDefault();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Star className="h-3.5 w-3.5" />
                    设为默认
                  </button>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============== Ollama Settings ==============

function OllamaSettings({ baseUrl }: { baseUrl: string }) {
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<
    Array<{ name: string; size: number; modified_at: string }>
  >([]);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const result = await settingsAPI.testOllamaConnection(baseUrl, 'chat');
      setConnected(result.success);
      setOllamaModels(result.all_models || result.models || []);
    } catch {
      setConnected(false);
      setOllamaModels([]);
    } finally {
      setChecking(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-4xl"
    >
      <h3 className="text-2xl font-bold text-slate-900">Ollama 配置</h3>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        管理本地 Ollama 服务，查看和下载模型
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1 mr-6">
            <h4 className="text-base font-semibold text-slate-900">
              Ollama 服务状态
            </h4>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              自动检测本地 Ollama 服务是否可用。如果服务未运行或地址配置错误，将显示"不可用"状态
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {checking ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                检测中...
              </span>
            ) : connected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-sm font-medium rounded-full border border-green-200">
                <Check className="h-4 w-4" />
                可用
              </span>
            ) : connected === false ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-500 text-sm font-medium rounded-full border border-red-200">
                <AlertCircle className="h-4 w-4" />
                不可用
              </span>
            ) : null}
            <button
              onClick={checkConnection}
              disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', checking && 'animate-spin')}
              />
              重新检测
            </button>
          </div>
        </div>

        <div className="flex items-start gap-8">
          <div className="flex-shrink-0 max-w-[220px]">
            <h4 className="text-base font-semibold text-slate-900">
              服务地址
            </h4>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              本地 Ollama 服务的 API 地址，由系统自动检测。如需修改，请在 .env
              配置文件中设置
            </p>
          </div>
          <div className="flex-1">
            <input
              type="text"
              readOnly
              value={baseUrl}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 cursor-default"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">已下载的模型</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              已安装在 Ollama 中的模型列表
            </p>
          </div>
          <button
            onClick={checkConnection}
            disabled={checking}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-4 w-4', checking && 'animate-spin')}
            />
            刷新
          </button>
        </div>

        {checking && ollamaModels.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : ollamaModels.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <Server className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {connected === false
                ? 'Ollama 服务不可用，请检查是否已启动'
                : '暂无已下载的模型'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ollamaModels.map((m) => (
              <div
                key={m.name}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-blue-300 transition-colors"
              >
                <p className="font-mono text-sm font-semibold text-slate-900 truncate">
                  {m.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatSize(m.size)}&nbsp;&nbsp;{formatDate(m.modified_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============== Model Form Modal ==============

function ModelFormModal({
  model,
  defaultModelType,
  ollamaBaseUrl,
  onClose,
  onSuccess,
}: {
  model: ModelConfig | null;
  defaultModelType?: string;
  ollamaBaseUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!model;
  const modelType = model?.model_type || defaultModelType || 'chat';
  const isEmbedding = modelType === 'embedding';

  const [source, setSource] = useState<'ollama' | 'remote'>(
    model ? (model.provider === 'ollama' ? 'ollama' : 'remote') : 'ollama'
  );
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Ollama
  const [ollamaModels, setOllamaModels] = useState<
    Array<{ name: string; size: number; modified_at: string }>
  >([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Form
  const [modelName, setModelName] = useState(model?.model_name || '');
  const [provider, setProvider] = useState(
    model?.provider && model.provider !== 'ollama' ? model.provider : 'custom'
  );
  const [baseUrl, setBaseUrl] = useState(
    model?.provider !== 'ollama' ? model?.base_url || '' : ''
  );
  const [apiKey, setApiKey] = useState('');
  const [vectorDimension, setVectorDimension] = useState(
    model?.params_json?.vector_dimension?.toString() || ''
  );

  // Connection test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (source === 'ollama') {
      loadOllamaModels();
    }
  }, [source]);

  const loadOllamaModels = async () => {
    setOllamaLoading(true);
    try {
      const result = await settingsAPI.testOllamaConnection(
        ollamaBaseUrl,
        modelType
      );
      if (result.success) {
        setOllamaModels(result.all_models || result.models || []);
      }
    } catch {
      /* ignore */
    } finally {
      setOllamaLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!baseUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(baseUrl.replace(/\/$/, '') + '/models', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      setTestResult(resp.ok);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!modelName) {
      alert('请选择或填写模型名称');
      return;
    }
    if (source === 'remote' && !baseUrl) {
      alert('请填写 Base URL');
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        name: model?.name || modelName,
        model_type: modelType,
        provider: source === 'ollama' ? 'ollama' : provider,
        base_url: source === 'ollama' ? ollamaBaseUrl : baseUrl,
        model_name: modelName,
        api_key:
          source === 'ollama'
            ? 'ollama-no-key-needed'
            : apiKey || (isEditing ? undefined : 'no-key'),
        max_concurrency: model?.max_concurrency || 4,
        rate_limit_rpm: model?.rate_limit_rpm || 60,
        enabled: model?.enabled ?? true,
      };

      if (isEmbedding && vectorDimension) {
        data.params_json = {
          ...(model?.params_json || {}),
          vector_dimension: parseInt(vectorDimension, 10),
        };
      }

      if (isEditing) {
        await settingsAPI.updateModel(model!.id, data);
      } else {
        await settingsAPI.createModel(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save model:', error);
      alert('保存失败，请检查配置');
    } finally {
      setSaving(false);
    }
  };

  const remoteProviders = [
    { value: 'custom', label: '自定义 (OpenAI兼容接口)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'azure_openai', label: 'Azure OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'cohere', label: 'Cohere' },
  ];

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
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {isEditing ? '编辑模型' : '添加模型'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {MODEL_TYPE_SUBTITLES[modelType] || ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors -mt-1 -mr-1"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* 模型来源 */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-3">
              模型来源 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-8">
              <label
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => {
                  setSource('ollama');
                  setModelName('');
                }}
              >
                <div
                  className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    source === 'ollama'
                      ? 'border-blue-500'
                      : 'border-slate-300'
                  )}
                >
                  {source === 'ollama' && (
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="text-sm text-slate-700">Ollama（本地）</span>
              </label>
              <label
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => {
                  setSource('remote');
                  setModelName('');
                }}
              >
                <div
                  className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    source === 'remote'
                      ? 'border-blue-500'
                      : 'border-slate-300'
                  )}
                >
                  {source === 'remote' && (
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="text-sm text-slate-700">
                  Remote API（远程）
                </span>
              </label>
            </div>
          </div>

          {source === 'ollama' ? (
            /* ===== Ollama Mode ===== */
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  模型名称 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-sm pr-10"
                    >
                      <option value="">搜索模型...</option>
                      {ollamaModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={loadOllamaModels}
                    disabled={ollamaLoading}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        'h-3.5 w-3.5',
                        ollamaLoading && 'animate-spin'
                      )}
                    />
                    刷新列表
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ===== Remote API Mode ===== */
            <div className="space-y-5">
              {/* 服务商 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  服务商
                </label>
                <div className="relative">
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-sm pr-10"
                  >
                    {remoteProviders.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* 模型名称 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  模型名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="例如: gpt-4, claude-3-opus"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="例如: https://api.openai.com/v1"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  API Key（可选）
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="输入 API Key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* 连接测试 */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  连接测试
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={!baseUrl || testing}
                    className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        测试中...
                      </span>
                    ) : (
                      '测试连接'
                    )}
                  </button>
                  {testResult === true && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      连接成功
                    </span>
                  )}
                  {testResult === false && (
                    <span className="flex items-center gap-1 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      连接失败
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 向量维度 - embedding only */}
          {isEmbedding && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                向量维度
              </label>
              <input
                type="number"
                min="1"
                value={vectorDimension}
                onChange={(e) => setVectorDimension(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="例如: 1536"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !modelName}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
