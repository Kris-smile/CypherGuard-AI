import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, 
  MessageSquare, 
  Database, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  User,
  Bell,
  Search,
  Plus,
  Bot,
  Trash2,
  MoreHorizontal,
  Cpu,
} from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
  const [chatModels, setChatModels] = useState<ModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadConversations = useCallback(async () => {
    try { setConversations(await chatAPI.listConversations()); } catch (e) { console.error(e); }
  }, []);

  const loadChatModels = useCallback(async () => {
    try {
      const models = await settingsAPI.listChatModels();
      setChatModels(models);
      const defaultModel = models.find(m => m.is_default);
      if (defaultModel && !selectedModelId) {
        setSelectedModelId(defaultModel.id);
      } else if (models.length > 0 && !selectedModelId) {
        setSelectedModelId(models[0].id);
      }
    } catch (e) { console.error(e); }
  }, [selectedModelId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      loadConversations();
      loadChatModels();
    }
  }, [activeTab, loadConversations, loadChatModels]);

  const handleNewConversation = async () => {
    const emptyConv = conversations.find(c => !c.title || c.title === '新对话');
    if (emptyConv) {
      setCurrentConversation(emptyConv);
      return;
    }
    try {
      const conv = await chatAPI.createConversation(selectedMode);
      setCurrentConversation(conv);
      await loadConversations();
    } catch (e) { console.error(e); }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    try {
      await chatAPI.deleteConversation(convId);
      if (currentConversation?.id === convId) setCurrentConversation(null);
      await loadConversations();
    } catch (err) { console.error(err); }
  };

  const handleConversationCreated = (conv: Conversation) => {
    setCurrentConversation(conv);
    loadConversations();
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
            useAgent={useAgent}
            selectedModelId={selectedModelId || undefined}
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
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900 selection:bg-blue-100">
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? (isChatActive ? 320 : 280) : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-20 flex flex-col bg-[#0B1121] text-slate-300 border-r border-slate-800 shadow-2xl"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex-shrink-0">
               <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 animate-pulse" />
               <Shield className="h-7 w-7 text-blue-500 relative z-10" />
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col"
                >
                  <span className="font-bold text-lg text-white tracking-tight">CypherGuard</span>
                  <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold">企业版</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow-lg shadow-blue-900/50 transition-all border border-blue-400/20 z-50"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Main Navigation */}
        <nav className="py-4 px-3 space-y-1 flex-shrink-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.1)]" 
                    : "hover:bg-slate-800/50 hover:text-white"
                )}
              >
                {isActive && (
                   <motion.div 
                     layoutId="active-pill"
                     className="absolute left-0 w-1 h-7 bg-blue-500 rounded-r-full"
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                   />
                )}
                
                <item.icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive ? "text-blue-400" : "text-slate-400 group-hover:text-white"
                )} />
                
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="font-medium whitespace-nowrap text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {isSidebarOpen && item.badge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  >
                    {item.badge}
                  </motion.span>
                )}

                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Chat Conversations Panel - shown when chat is active and sidebar is open */}
        {isChatActive && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col border-t border-slate-800/50 overflow-hidden min-h-0"
          >
            {/* New Chat + Controls */}
            <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 px-3 rounded-xl transition-colors"
              >
                <Plus className="h-4 w-4" />
                新建对话
              </button>

              <div className="flex gap-2">
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="quick">快速模式</option>
                  <option value="strict">严谨模式</option>
                </select>
                <button
                  onClick={() => setUseAgent(!useAgent)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    useAgent
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                  )}
                  title={useAgent ? 'Agent 模式已开启' : 'Agent 模式'}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Agent
                </button>
              </div>

              {chatModels.length > 0 && (
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                  >
                    {chatModels.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.is_default ? ' (默认)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 scrollbar-thin">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  暂无对话记录
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = currentConversation?.id === conv.id;
                  const isMenuOpen = menuOpenId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setCurrentConversation(conv)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group cursor-pointer flex items-center gap-1 relative',
                        isActive
                          ? 'bg-blue-600/15 text-blue-300'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">
                          {conv.title || '新对话'}
                        </p>
                        <p className="text-[11px] mt-0.5 opacity-60">
                          {new Date(conv.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="relative flex-shrink-0" ref={isMenuOpen ? menuRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : conv.id); }}
                          className={cn(
                            'p-1 rounded transition-all',
                            isMenuOpen
                              ? 'opacity-100 bg-slate-700 text-slate-200'
                              : 'opacity-0 group-hover:opacity-100 hover:bg-slate-700 hover:text-slate-200'
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[120px]"
                            >
                              <button
                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/15 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                删除对话
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* Spacer when not chat or sidebar collapsed */}
        {(!isChatActive || !isSidebarOpen) && <div className="flex-1" />}

        {/* Bottom: Settings + User */}
        <div className="border-t border-slate-800/50 bg-[#0B1121] flex-shrink-0">
          {/* Settings Button */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                activeTab === 'settings'
                  ? "bg-blue-600/10 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.1)]"
                  : "hover:bg-slate-800/50 hover:text-white"
              )}
            >
              {activeTab === 'settings' && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-7 bg-blue-500 rounded-r-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <SettingsIcon className={cn(
                "h-5 w-5 flex-shrink-0 transition-colors",
                activeTab === 'settings' ? "text-blue-400" : "text-slate-400 group-hover:text-white"
              )} />
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-medium whitespace-nowrap text-sm"
                  >
                    系统设置
                  </motion.span>
                )}
              </AnimatePresence>
              {!isSidebarOpen && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                  系统设置
                </div>
              )}
            </button>
          </div>

          {/* User Profile */}
          <div className="p-3 pt-1">
            <div className={cn(
              "flex items-center gap-3 w-full p-2 rounded-xl cursor-pointer transition-all duration-200",
              activeTab === 'profile'
                ? "bg-blue-600/10 ring-1 ring-blue-500/20"
                : "hover:bg-slate-800/50",
              !isSidebarOpen && "justify-center"
            )}
              onClick={() => setActiveTab('profile')}
              title="个人中心"
            >
              <div className="relative flex-shrink-0">
                 <div className={cn(
                   "h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg ring-2 transition-all",
                   activeTab === 'profile' ? "ring-blue-500" : "ring-slate-900"
                 )}>
                    <User className="h-4 w-4" />
                 </div>
                 <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border-2 border-[#0B1121] rounded-full"></div>
              </div>
              
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex flex-col items-start overflow-hidden flex-1"
                  >
                    <span className="text-sm font-semibold text-white truncate">{user?.username || '用户'}</span>
                    <span className="text-[11px] text-slate-500 truncate">{user?.role === 'admin' ? '管理员' : '普通用户'}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {isSidebarOpen && (
                 <button
                   onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                   className="p-1 hover:bg-slate-800 rounded transition-colors"
                   title="退出登录"
                 >
                   <LogOut className="h-4 w-4 text-slate-500 hover:text-red-400 transition-colors" />
                 </button>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9] relative">
         <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-[#F1F5F9]" />

         {/* Top Header */}
         <header className="h-16 px-8 flex items-center justify-between relative z-10 flex-shrink-0">
            <div>
               <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                 {allNavLabels[activeTab] || '知识库'}
               </h1>
               <p className="text-xs text-slate-500 mt-0.5">CypherGuard AI 智能安全知识管理</p>
            </div>

            <div className="flex items-center gap-4">
               <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                     type="text" 
                     placeholder="搜索知识库..." 
                     className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-56 shadow-sm"
                  />
               </div>
               <button className="relative p-2 text-slate-500 hover:bg-white rounded-full transition-colors">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-[#F1F5F9]"></span>
               </button>
            </div>
         </header>

         {/* Dashboard Content */}
         <div className="flex-1 overflow-hidden relative z-10">
            {renderContent()}
         </div>
      </main>
    </div>
  );
}
