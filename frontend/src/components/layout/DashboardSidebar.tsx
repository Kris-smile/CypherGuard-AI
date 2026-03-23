import type { ElementType, MouseEvent as ReactMouseEvent, MutableRefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { cn } from '../../utils';
import type { Conversation, User as AppUser } from '../../services/api';

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  badge?: string;
};

interface DashboardSidebarProps {
  isSidebarOpen: boolean;
  isChatActive: boolean;
  activeTab: string;
  navItems: NavItem[];
  conversations: Conversation[];
  currentConversation: Conversation | null;
  menuOpenId: string | null;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  user: AppUser | null;
  onToggleSidebar: () => void;
  onTabChange: (tab: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onToggleConversationMenu: (conversationId: string) => void;
  onEditConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string, event: ReactMouseEvent) => void;
  onLogout: (event: ReactMouseEvent) => void;
}

function SidebarNavButton({
  icon: Icon,
  label,
  isActive,
  isSidebarOpen,
  badge,
  onClick,
}: {
  icon: ElementType;
  label: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-all',
        isActive
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 flex-shrink-0',
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700',
        )}
      />

      <AnimatePresence>
        {isSidebarOpen ? (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="whitespace-nowrap font-medium"
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {isSidebarOpen && badge ? (
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
            isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500',
          )}
        >
          {badge}
        </span>
      ) : null}

      {!isSidebarOpen ? (
        <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          {label}
        </div>
      ) : null}
    </button>
  );
}

export function DashboardSidebar({
  isSidebarOpen,
  isChatActive,
  activeTab,
  navItems,
  conversations,
  currentConversation,
  menuOpenId,
  menuRef,
  user,
  onToggleSidebar,
  onTabChange,
  onNewConversation,
  onSelectConversation,
  onToggleConversationMenu,
  onEditConversation,
  onDeleteConversation,
  onLogout,
}: DashboardSidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? (isChatActive ? 320 : 280) : 84 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative z-20 flex flex-col border-r border-slate-200 bg-white text-slate-700"
    >
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <AnimatePresence>
            {isSidebarOpen ? (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex min-w-0 flex-col"
              >
                <span className="truncate text-lg font-bold tracking-tight text-slate-900">
                  CypherGuard
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  AI Workspace
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <button
        onClick={onToggleSidebar}
        className="absolute -right-3 top-20 rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        {isSidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      <nav className="space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <SidebarNavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            isActive={activeTab === item.id}
            isSidebarOpen={isSidebarOpen}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>

      {isChatActive && isSidebarOpen ? (
        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200">
          <div className="px-3 pb-2 pt-3">
            <button
              onClick={onNewConversation}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                No conversation history yet
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = currentConversation?.id === conversation.id;
                const isMenuOpen = menuOpenId === conversation.id;

                return (
                  <div
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation)}
                    className={cn(
                      'group relative flex cursor-pointer items-center gap-1 rounded-2xl border px-3 py-2.5 transition-colors',
                      isActive
                        ? 'border-slate-200 bg-slate-100 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {conversation.title || 'New conversation'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {new Date(conversation.created_at).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="relative flex-shrink-0" ref={isMenuOpen ? menuRef : undefined}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleConversationMenu(conversation.id);
                        }}
                        className={cn(
                          'rounded-lg p-1 transition-all',
                          isMenuOpen
                            ? 'bg-white text-slate-700 ring-1 ring-slate-200'
                            : 'opacity-0 hover:bg-white hover:text-slate-700 group-hover:opacity-100',
                        )}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {isMenuOpen ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 top-full z-50 mt-1 min-w-[128px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                          >
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditConversation(conversation);
                                onToggleConversationMenu(conversation.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              编辑
                            </button>
                            <button
                              onClick={(event) => onDeleteConversation(conversation.id, event)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-500 transition-colors hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 border-t border-slate-200" />
      )}

      <div className="border-t border-slate-200 bg-white">
        <div className="px-3 pb-1 pt-3">
          <SidebarNavButton
            icon={SettingsIcon}
            label="System Settings"
            isActive={activeTab === 'settings'}
            isSidebarOpen={isSidebarOpen}
            onClick={() => onTabChange('settings')}
          />
        </div>

        <div className="p-3 pt-1">
          <div
            onClick={() => onTabChange('profile')}
            title="Profile"
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition-colors',
              activeTab === 'profile'
                ? 'border-slate-200 bg-slate-100'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
              !isSidebarOpen && 'justify-center',
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                <User className="h-4 w-4" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <AnimatePresence>
              {isSidebarOpen ? (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="min-w-0 flex-1 overflow-hidden"
                >
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {user?.username || 'User'}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {user?.role === 'admin' ? 'Administrator' : 'Member'}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {isSidebarOpen ? (
              <button
                onClick={onLogout}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-rose-500"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
