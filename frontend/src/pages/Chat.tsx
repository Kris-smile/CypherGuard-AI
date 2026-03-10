import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, Loader2, MessageSquare, FileText, ChevronDown, Bot, Zap, Copy, Check, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { chatAPI } from '../services/api';
import type { Message, Citation, Conversation } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatProps {
  currentConversation: Conversation | null;
  onConversationCreated?: (conv: Conversation) => void;
  selectedMode: string;
  useAgent: boolean;
  selectedModelId?: string;
}

export default function Chat({ currentConversation, onConversationCreated, selectedMode, useAgent, selectedModelId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [attachedImages, setAttachedImages] = useState<{ base64: string; preview: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    } else {
      setMessages([]);
    }
  }, [currentConversation]);

  useEffect(() => { scrollToBottom(); }, [messages, streamingText]);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addImages = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const newImages = await Promise.all(
      imageFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        return { base64, preview };
      })
    );
    setAttachedImages(prev => [...prev, ...newImages].slice(0, 5));
  }, []);

  const removeImage = (index: number) => {
    setAttachedImages(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      addImages(imageFiles);
    }
  }, [addImages]);

  const loadMessages = async (conversationId: string) => {
    try { setMessages(await chatAPI.getMessages(conversationId)); } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedImages.length === 0) || loading) return;

    let conv = currentConversation;
    if (!conv) {
      try {
        conv = await chatAPI.createConversation(selectedMode);
        onConversationCreated?.(conv);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    const userMessage = input;
    const imagesToSend = attachedImages.map(img => img.base64);
    const imagePreviews = attachedImages.map(img => img.preview);
    setInput('');
    setAttachedImages([]);
    setLoading(true);
    setStreamingText('');
    setStreamStatus('');

    const fakeUserMsg: Message = {
      id: `temp-${Date.now()}`, conversation_id: conv.id, role: 'user',
      content: userMessage, created_at: new Date().toISOString(),
      _imagePreviews: imagePreviews,
    };
    setMessages(prev => [...prev, fakeUserMsg]);

    try {
      if (useAgent) {
        await chatAPI.sendMessageAgent(conv.id, userMessage, imagesToSend, selectedModelId);
        await loadMessages(conv.id);
      } else {
        await chatAPI.sendMessageStream(
          conv.id, userMessage,
          (token) => setStreamingText(prev => prev + token),
          (status) => setStreamStatus(status),
          () => {
            setStreamingText('');
            setStreamStatus('');
            loadMessages(conv!.id);
            onConversationCreated?.(conv!);
          },
          imagesToSend,
          selectedModelId,
        );
      }
    } catch (e) {
      console.error(e);
      alert('发送消息失败，请重试。');
    } finally {
      setLoading(false);
      setStreamingText('');
      setStreamStatus('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!currentConversation) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <MessageSquare className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">开始新对话</h2>
            <p className="text-slate-500 mb-8">基于知识库进行智能问答，在下方输入您的问题</p>
          </div>
        </div>
        <ChatInputArea
          input={input}
          setInput={setInput}
          loading={loading}
          attachedImages={attachedImages}
          handleSend={handleSend}
          handleKeyPress={handleKeyPress}
          handlePaste={handlePaste}
          addImages={addImages}
          removeImage={removeImage}
          fileInputRef={fileInputRef}
          placeholder="输入问题，开始新对话..."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
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
            className="flex flex-col gap-2"
          >
            {streamStatus && (
              <div className="flex items-center gap-2 text-sm text-blue-500">
                <Zap className="h-4 w-4" />
                <span>{streamStatus}</span>
              </div>
            )}
            {streamingText ? (
              <div className="max-w-3xl bg-white border border-slate-200 rounded-2xl px-5 py-3">
                <div className="prose-sm max-w-none text-slate-900">
                  <MarkdownContent content={streamingText} />
                  <span className="animate-pulse text-blue-500">▌</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{useAgent ? 'Agent 推理中...' : '思考中...'}</span>
              </div>
            )}
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInputArea
        input={input}
        setInput={setInput}
        loading={loading}
        attachedImages={attachedImages}
        handleSend={handleSend}
        handleKeyPress={handleKeyPress}
        handlePaste={handlePaste}
        addImages={addImages}
        removeImage={removeImage}
        fileInputRef={fileInputRef}
        placeholder="输入问题，向知识库提问..."
      />
    </div>
  );
}

interface ChatInputAreaProps {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  attachedImages: { base64: string; preview: string }[];
  handleSend: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  addImages: (files: FileList | File[]) => void;
  removeImage: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
}

function ChatInputArea({
  input, setInput, loading, attachedImages, handleSend, handleKeyPress,
  handlePaste, addImages, removeImage, fileInputRef, placeholder,
}: ChatInputAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addImages(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        "border-t border-slate-200 bg-white p-4 transition-colors",
        isDragging && "bg-blue-50 border-blue-300"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        <AnimatePresence>
          {attachedImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 mb-3 flex-wrap"
            >
              {attachedImages.map((img, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative group"
                >
                  <img
                    src={img.preview}
                    alt={`附件 ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border border-slate-200 shadow-sm"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isDragging && (
          <div className="flex items-center justify-center gap-2 py-4 mb-3 border-2 border-dashed border-blue-400 rounded-xl text-blue-500 text-sm">
            <ImageIcon className="h-5 w-5" />
            <span>释放以添加图片</span>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addImages(e.target.files); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-blue-500 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            title="上传图片 (最多5张)"
            disabled={loading}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder={attachedImages.length > 0 ? "描述图片或提问..." : placeholder}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && attachedImages.length === 0)}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          支持粘贴截图 · 拖拽图片 · 点击📎上传{attachedImages.length > 0 && ` · 已添加 ${attachedImages.length}/5 张`}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const codeStr = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!className) {
    return <code className="px-1.5 py-0.5 bg-slate-100 text-red-600 rounded text-[13px] font-mono" {...props}>{children}</code>;
  }

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-200 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-xs text-slate-400">
        <span className="font-mono uppercase">{lang || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <><Check className="h-3.5 w-3.5 text-green-400" /> 已复制</> : <><Copy className="h-3.5 w-3.5" /> 复制</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed"><code className={className} {...props}>{children}</code></pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: CodeBlock,
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3">{children}</h3>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 my-3 text-slate-600 italic">{children}</blockquote>,
        table: ({ children }) => <div className="overflow-x-auto my-3"><table className="min-w-full border-collapse border border-slate-200 text-sm">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
        th: ({ children }) => <th className="border border-slate-200 px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-slate-200 px-3 py-2">{children}</td>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>,
        hr: () => <hr className="my-4 border-slate-200" />,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

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
          {isUser ? (
            <>
              {(() => {
                const previews = message._imagePreviews;
                const dbImages = message.images_json;
                const imageSrcs = previews?.length ? previews
                  : dbImages?.length ? dbImages.map(b64 =>
                      b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`
                    )
                  : [];
                return imageSrcs.length > 0 ? (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {imageSrcs.map((src: string, i: number) => (
                      <img key={i} src={src} alt="" className="h-24 w-24 object-cover rounded-lg border border-blue-400/30" />
                    ))}
                  </div>
                ) : null;
              })()}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </>
          ) : (
            <div className="prose-sm max-w-none">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>

        {!isUser && message.citations_json && message.citations_json.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{message.citations_json.length} 个引用来源</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showCitations && 'rotate-180')} />
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
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{citation.title}</span>
                          </p>
                          {citation.page_start && (
                            <p className="text-xs text-slate-500 mt-1">
                              第 {citation.page_start} 页
                              {citation.page_end && citation.page_end !== citation.page_start ? ` - 第 ${citation.page_end} 页` : ''}
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
