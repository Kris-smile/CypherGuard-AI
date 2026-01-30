// Chat Page - AI对话页面
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, MessageSquare, FileText, ChevronDown } from 'lucide-react';
import { chatAPI } from '../services/api';
import type { Message, Citation, Conversation } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState('quick');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const convs = await chatAPI.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const msgs = await chatAPI.getMessages(conversationId);
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const startNewConversation = async () => {
    try {
      const conv = await chatAPI.createConversation(selectedMode);
      setCurrentConversation(conv);
      setMessages([]);
      await loadConversations();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // Create conversation if needed
    if (!currentConversation) {
      await startNewConversation();
      return;
    }

    const userMessage = input;
    setInput('');
    setLoading(true);

    try {
      await chatAPI.sendMessage(currentConversation.id, userMessage);
      
      // Reload messages to get the full conversation
      await loadMessages(currentConversation.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Conversations */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={startNewConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-5 w-5" />
            New Conversation
          </button>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Mode</label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="quick">Quick</option>
              <option value="strict">Strict</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-colors',
                currentConversation?.id === conv.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-slate-50 border border-transparent'
              )}
            >
              <p className="font-medium text-slate-900 truncate">
                {conv.title || 'New Conversation'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(conv.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {currentConversation ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <MessageBubble key={msg.id || idx} message={msg} />
                ))}
              </AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 text-slate-500"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Thinking...</span>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="max-w-4xl mx-auto flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about your knowledge base..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-6 w-6" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">Start a new conversation</p>
              <p className="text-sm mt-2">Ask questions about your knowledge base</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [showCitations, setShowCitations] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-3xl', isUser ? 'w-auto' : 'w-full')}>
        <div
          className={cn(
            'rounded-2xl px-5 py-3',
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-200 text-slate-900'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Citations */}
        {!isUser && message.citations_json && message.citations_json.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{message.citations_json.length} sources</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  showCitations && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence>
              {showCitations && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2"
                >
                  {message.citations_json.map((citation: Citation, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{citation.title}</span>
                          </p>
                          {citation.page_start && (
                            <p className="text-xs text-slate-500 mt-1">
                              Page {citation.page_start}
                              {citation.page_end && citation.page_end !== citation.page_start
                                ? `-${citation.page_end}`
                                : ''}
                            </p>
                          )}
                          <p className="text-slate-600 mt-2 line-clamp-2">{citation.snippet}</p>
                        </div>
                        <div className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {(citation.score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
