import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Database, MessageSquare, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSidebar } from '../components/layout/DashboardSidebar';
import { chatAPI, settingsAPI } from '../services/api';
import type { Conversation, ModelConfig } from '../services/api';
import Chat from './Chat';
import KnowledgeBase from './KnowledgeBase';
import Settings from './Settings';
import UserProfile from './UserProfile';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

const navItems: NavItem[] = [
  { id: 'kb', label: '知识库', icon: Database },
  { id: 'chat', label: '智能对话', icon: MessageSquare, badge: 'AI' },
];

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('kb');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [selectedMode, setSelectedMode] = useState('quick');
  const [useAgent, setUseAgent] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editingConversation, setEditingConversation] = useState<Conversation | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [chatModels, setChatModels] = useState<ModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await chatAPI.listConversations());
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadChatModels = useCallback(async () => {
    try {
      const models = await settingsAPI.listChatModels();
      setChatModels(models);

      const defaultModel = models.find((model) => model.is_default);
      if (defaultModel && !selectedModelId) {
        setSelectedModelId(defaultModel.id);
      } else if (models.length > 0 && !selectedModelId) {
        setSelectedModelId(models[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  }, [selectedModelId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      loadConversations();
      loadChatModels();
    }
  }, [activeTab, loadConversations, loadChatModels]);

  const handleNewConversation = async () => {
    const emptyConversation = conversations.find(
      (conversation) => !conversation.title || conversation.title === '新对话',
    );

    if (emptyConversation) {
      setCurrentConversation(emptyConversation);
      return;
    }

    try {
      const conversation = await chatAPI.createConversation(selectedMode);
      setCurrentConversation(conversation);
      await loadConversations();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditConversation = (conversation: Conversation) => {
    setEditingConversation(conversation);
    setEditingTitle(conversation.title?.trim() || '');
  };

  const handleUpdateConversationTitle = async () => {
    if (!editingConversation) return;
    const title = editingTitle.trim() || undefined;
    try {
      const updated = await chatAPI.updateConversation(editingConversation.id, { title });
      await loadConversations();
      if (currentConversation?.id === editingConversation.id) {
        setCurrentConversation(updated);
      }
      setEditingConversation(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpenId(null);

    try {
      await chatAPI.deleteConversation(conversationId);
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
      await loadConversations();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConversationCreated = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadConversations();
  };

  const toggleSidebar = () => setIsSidebarOpen((current) => !current);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <Chat
            currentConversation={currentConversation}
            onConversationCreated={handleConversationCreated}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            useAgent={useAgent}
            setUseAgent={setUseAgent}
            selectedModelId={selectedModelId || undefined}
            setSelectedModelId={setSelectedModelId}
            chatModels={chatModels}
          />
        );
      case 'kb':
        return <KnowledgeBase />;
      case 'settings':
        return <Settings onClose={() => setActiveTab('kb')} />;
      case 'profile':
        return <UserProfile onBack={() => setActiveTab('kb')} />;
      default:
        return <KnowledgeBase />;
    }
  };

  const allNavLabels: Record<string, string> = {
    kb: '知识库',
    chat: '智能对话',
    settings: '系统设置',
    profile: '个人中心',
  };

  const isChatActive = activeTab === 'chat';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <DashboardSidebar
        isSidebarOpen={isSidebarOpen}
        isChatActive={isChatActive}
        activeTab={activeTab}
        navItems={navItems}
        conversations={conversations}
        currentConversation={currentConversation}
        menuOpenId={menuOpenId}
        menuRef={menuRef}
        user={user}
        onToggleSidebar={toggleSidebar}
        onTabChange={setActiveTab}
        onNewConversation={handleNewConversation}
        onSelectConversation={setCurrentConversation}
        onToggleConversationMenu={(conversationId) =>
          setMenuOpenId((currentId) => (currentId === conversationId ? null : conversationId))
        }
        onEditConversation={handleEditConversation}
        onDeleteConversation={handleDeleteConversation}
        onLogout={(event) => {
          event.stopPropagation();
          handleLogout();
        }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-slate-50">
        <div className="absolute left-0 top-0 h-64 w-full bg-gradient-to-b from-white to-slate-50" />

        <header className="relative z-10 flex h-16 flex-shrink-0 items-center justify-between px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {allNavLabels[activeTab] || '知识库'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              CypherGuard AI 智能安全知识管理
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索知识库..."
                className="w-56 rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-white">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-slate-50 bg-red-500" />
            </button>
          </div>
        </header>

        <div className="relative z-10 flex-1 overflow-hidden">{renderContent()}</div>
      </main>

      {editingConversation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditingConversation(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-800">编辑对话名称</h3>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="输入对话名称"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateConversationTitle();
                if (e.key === 'Escape') setEditingConversation(null);
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingConversation(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpdateConversationTitle}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
