import React, { useState } from 'react';
import { 
  Shield, 
  MessageSquare, 
  Database, 
  Cpu, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  User,
  Bell,
  Search,
  Activity
} from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Chat from './Chat';
import KnowledgeBase from './KnowledgeBase';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

const navItems: NavItem[] = [
  { id: 'chat', label: 'Neural Chat', icon: MessageSquare, badge: 'AI' },
  { id: 'kb', label: 'Knowledge Core', icon: Database },
  { id: 'models', label: 'Model Nexus', icon: Cpu },
  { id: 'settings', label: 'System Config', icon: Settings },
];

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <Chat />;
      case 'kb':
        return <KnowledgeBase />;
      case 'models':
        return <PlaceholderContent title="Model Configuration" icon={Cpu} />;
      case 'settings':
        return <PlaceholderContent title="System Settings" icon={Settings} />;
      default:
        return <PlaceholderContent title="Dashboard" icon={Activity} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900 selection:bg-blue-100">
      
      {/* Sidebar - Glass Dark Theme */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-20 flex flex-col bg-[#0B1121] text-slate-300 border-r border-slate-800 shadow-2xl"
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex-shrink-0">
               <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 animate-pulse" />
               <Shield className="h-8 w-8 text-blue-500 relative z-10" />
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
                  <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold">Enterprise</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-24 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow-lg shadow-blue-900/50 transition-all border border-blue-400/20 z-50"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Navigation Links */}
        <nav className="flex-1 py-8 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.1)]" 
                    : "hover:bg-slate-800/50 hover:text-white"
                )}
              >
                {isActive && (
                   <motion.div 
                     layoutId="active-pill"
                     className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full"
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
                      className="font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Badge */}
                {isSidebarOpen && item.badge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  >
                    {item.badge}
                  </motion.span>
                )}

                {/* Tooltip for collapsed state */}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800/50 bg-[#0B1121]">
          <div className={cn(
            "flex items-center gap-3 w-full p-2 rounded-xl",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="relative">
               <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg ring-2 ring-slate-900">
                  <User className="h-5 w-5" />
               </div>
               <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex flex-col items-start overflow-hidden flex-1"
                >
                  <span className="text-sm font-semibold text-white truncate">{user?.username || 'User'}</span>
                  <span className="text-xs text-slate-500 truncate">{user?.role || 'user'}</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isSidebarOpen && (
               <button onClick={handleLogout} className="p-1 hover:bg-slate-800 rounded transition-colors">
                 <LogOut className="h-4 w-4 text-slate-500 hover:text-red-400 transition-colors" />
               </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9] relative">
         {/* Background Decoration */}
         <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-[#F1F5F9]" />

         {/* Top Header */}
         <header className="h-20 px-8 flex items-center justify-between relative z-10">
            <div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                 {navItems.find(i => i.id === activeTab)?.label}
               </h1>
               <p className="text-sm text-slate-500 mt-0.5">Overview of system performance and metrics</p>
            </div>

            <div className="flex items-center gap-4">
               <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                     type="text" 
                     placeholder="Search intelligence..." 
                     className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 shadow-sm"
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


// Placeholder Content Component
function PlaceholderContent({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Icon className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
        <p className="text-slate-500 mt-2">This module is under development</p>
      </div>
    </div>
  );
}
