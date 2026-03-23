import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  BookOpen,
  Check,
  Cpu,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { chatAPI, kbAPI } from '../services/api';
import type {
  Conversation,
  Document,
  KnowledgeBaseItem,
  Message,
  ModelConfig,
} from '../services/api';
import { cn } from '../utils';
import AnswerContent from '../components/chat/AnswerContent';
import AnswerMessage from '../components/chat/AnswerMessage';
import SearchStatus from '../components/chat/SearchStatus';

interface ChatProps {
  currentConversation: Conversation | null;
  onConversationCreated?: (conversation: Conversation) => void;
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  useAgent: boolean;
  setUseAgent: (value: boolean) => void;
  selectedModelId?: string;
  setSelectedModelId: (id: string) => void;
  chatModels: ModelConfig[];
}

type AttachedImage = {
  base64: string;
  preview: string;
};

type ToastState = {
  id: number;
  message: string;
};

export default function Chat({
  currentConversation,
  onConversationCreated,
  selectedMode,
  setSelectedMode,
  useAgent,
  setUseAgent,
  selectedModelId,
  setSelectedModelId,
  chatModels,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
      return;
    }

    setMessages([]);
  }, [currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamStatus, streamingText]);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2400);
  }, []);

  const loadMessages = async (conversationId: string) => {
    try {
      setMessages(await chatAPI.getMessages(conversationId));
    } catch (error) {
      console.error(error);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      return;
    }

    const nextImages = await Promise.all(
      imageFiles.map(async (file) => ({
        base64: await fileToBase64(file),
        preview: URL.createObjectURL(file),
      })),
    );

    setAttachedImages((current) => [...current, ...nextImages].slice(0, 5));
  }, []);

  const removeImage = useCallback((index: number) => {
    setAttachedImages((current) => {
      const next = [...current];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }, []);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageFiles: File[] = [];
      for (let index = 0; index < items.length; index += 1) {
        if (items[index].type.startsWith('image/')) {
          const file = items[index].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length) {
        event.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages],
  );

  const handleSend = async () => {
    if ((!input.trim() && attachedImages.length === 0) || loading) {
      return;
    }

    let conversation = currentConversation;
    if (!conversation) {
      try {
        conversation = await chatAPI.createConversation(selectedMode);
        onConversationCreated?.(conversation);
      } catch (error) {
        console.error(error);
        return;
      }
    }

    const userContent = input;
    const imagePayload = attachedImages.map((image) => image.base64);
    const imagePreviews = attachedImages.map((image) => image.preview);
    const knowledgeBaseIds = selectedKbIds.length ? selectedKbIds : undefined;
    const documentIds = selectedDocIds.length ? selectedDocIds : undefined;
    const controller = new AbortController();

    setInput('');
    setAttachedImages([]);
    setLoading(true);
    setStreamingText('');
    setStreamStatus(enableWebSearch ? '正在联网搜索...' : '正在整理结果...');
    abortControllerRef.current = controller;

    const temporaryUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      role: 'user',
      content: userContent,
      created_at: new Date().toISOString(),
      _imagePreviews: imagePreviews,
    };

    setMessages((current) => [...current, temporaryUserMessage]);

    try {
      if (useAgent) {
        await chatAPI.sendMessageAgent(
          conversation.id,
          userContent,
          imagePayload,
          selectedModelId,
          knowledgeBaseIds,
          documentIds,
          enableWebSearch,
        );
        await loadMessages(conversation.id);
        onConversationCreated?.(conversation);
      } else {
        await chatAPI.sendMessageStream(
          conversation.id,
          userContent,
          (token) => setStreamingText((current) => current + token),
          (status) => setStreamStatus(status),
          async () => {
            setStreamingText('');
            setStreamStatus('');
            await loadMessages(conversation!.id);
            onConversationCreated?.(conversation!);
          },
          imagePayload,
          selectedModelId,
          knowledgeBaseIds,
          documentIds,
          enableWebSearch,
          controller.signal,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        await loadMessages(conversation.id);
      } else {
        console.error(error);
        showToast(enableWebSearch ? '搜索请求失败，请稍后重试' : '消息发送失败，请重试');
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setStreamingText('');
      setStreamStatus('');
    }
  };

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const buildInputHint = () => {
    const hasDocuments = selectedDocIds.length > 0;
    const hasKnowledgeBases = selectedKbIds.length > 0;

    if (hasDocuments && enableWebSearch) {
      return '输入问题，将优先基于选中的文件和网络搜索回答';
    }
    if (hasDocuments) {
      return '输入问题，将优先基于上方选中的文件回答';
    }
    if (hasKnowledgeBases && enableWebSearch) {
      return '输入问题，将基于知识库和网络搜索回答';
    }
    if (hasKnowledgeBases) {
      return '输入问题，将基于上方选中的知识库回答';
    }
    if (enableWebSearch) {
      return '输入问题，将结合网络搜索回答';
    }

    return '输入问题，开始新对话';
  };

  const toolbarProps = {
    chatModels,
    selectedModelId: selectedModelId || '',
    onModelChange: setSelectedModelId,
    selectedMode,
    onModeChange: setSelectedMode,
    useAgent,
    onAgentToggle: setUseAgent,
    enableWebSearch,
    onWebSearchToggle: setEnableWebSearch,
    selectedKbIds,
    selectedDocIds,
    onKbToggle: (kbId: string) => {
      setSelectedKbIds((current) =>
        current.includes(kbId) ? current.filter((id) => id !== kbId) : [...current, kbId],
      );
    },
    onDocumentToggle: (documentId: string) => {
      setSelectedDocIds((current) =>
        current.includes(documentId)
          ? current.filter((id) => id !== documentId)
          : [...current, documentId],
      );
    },
    showToast,
  };

  const inputHint = buildInputHint();

  if (!currentConversation) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 shadow-sm">
              <MessageSquare className="h-9 w-9 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">开始新的问答</h2>
            <p className="text-slate-500">可结合知识库、指定文件和联网搜索生成回答。</p>
          </div>
        </div>

        <ChatInputArea
          input={input}
          setInput={setInput}
          loading={loading}
          attachedImages={attachedImages}
          handleSend={handleSend}
          handleStop={handleStop}
          handleKeyPress={handleKeyPress}
          handlePaste={handlePaste}
          addImages={addImages}
          removeImage={removeImage}
          fileInputRef={fileInputRef}
          placeholder={inputHint}
          {...toolbarProps}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none fixed left-1/2 top-6 z-[100] flex -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} message={toast.message} />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AnimatePresence>
          {messages.map((message, index) => (
            <MessageBubble key={message.id || index} message={message} />
          ))}
        </AnimatePresence>

        {loading ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <SearchStatus status={streamStatus} />

            {streamingText ? (
              <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <AnswerContent content={streamingText} isStreaming />
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{useAgent ? 'Agent 正在推理...' : '正在准备回答...'}</span>
              </div>
            )}
          </motion.div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <ChatInputArea
        input={input}
        setInput={setInput}
        loading={loading}
        attachedImages={attachedImages}
        handleSend={handleSend}
        handleStop={handleStop}
        handleKeyPress={handleKeyPress}
        handlePaste={handlePaste}
        addImages={addImages}
        removeImage={removeImage}
        fileInputRef={fileInputRef}
        placeholder={inputHint}
        {...toolbarProps}
      />
    </div>
  );
}

function ToastItem({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex min-w-[220px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900">
        <Check className="h-4 w-4 text-white stroke-[2.5]" />
      </div>
      <span className="text-sm font-medium text-slate-800">{message}</span>
    </motion.div>
  );
}

interface ChatInputAreaProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  attachedImages: AttachedImage[];
  handleSend: () => void;
  handleStop: () => void;
  handleKeyPress: (event: React.KeyboardEvent) => void;
  handlePaste: (event: React.ClipboardEvent) => void;
  addImages: (files: FileList | File[]) => void | Promise<void>;
  removeImage: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  chatModels: ModelConfig[];
  selectedModelId: string;
  onModelChange: (id: string) => void;
  selectedMode: string;
  onModeChange: (mode: string) => void;
  useAgent: boolean;
  onAgentToggle: (value: boolean) => void;
  enableWebSearch: boolean;
  onWebSearchToggle: (value: boolean) => void;
  selectedKbIds: string[];
  selectedDocIds: string[];
  onKbToggle: (kbId: string) => void;
  onDocumentToggle: (documentId: string) => void;
  showToast: (message: string) => void;
}

function ToolbarDropdown({
  open,
  onClose,
  children,
  align = 'left',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute bottom-full z-50 mb-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white py-2 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ChatInputArea({
  input,
  setInput,
  loading,
  attachedImages,
  handleSend,
  handleStop,
  handleKeyPress,
  handlePaste,
  addImages,
  removeImage,
  fileInputRef,
  placeholder,
  chatModels,
  selectedModelId,
  onModelChange,
  selectedMode,
  onModeChange,
  useAgent,
  onAgentToggle,
  enableWebSearch,
  onWebSearchToggle,
  selectedKbIds,
  selectedDocIds,
  onKbToggle,
  onDocumentToggle,
  showToast,
}: ChatInputAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [kbSelectorLoading, setKbSelectorLoading] = useState(false);

  useEffect(() => {
    if (openDropdown !== 'kb' || kbSelectorLoading) {
      return;
    }

    if (knowledgeBases.length > 0 && documents.length > 0) {
      return;
    }

    setKbSelectorLoading(true);
    Promise.all([kbAPI.listKnowledgeBases(), kbAPI.listDocuments(0, 200)])
      .then(([nextKnowledgeBases, nextDocuments]) => {
        setKnowledgeBases(nextKnowledgeBases);
        setDocuments(nextDocuments);
      })
      .catch(() => undefined)
      .finally(() => setKbSelectorLoading(false));
  }, [documents.length, kbSelectorLoading, knowledgeBases.length, openDropdown]);

  const availableDocuments = useMemo(
    () =>
      documents
        .filter((document) => document.status === 'ready' && document.parse_status === 'completed')
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at)),
    [documents],
  );

  const documentKbNameMap = useMemo(
    () => new Map(knowledgeBases.map((kb) => [kb.id, kb.name])),
    [knowledgeBases],
  );

  const visibleDocuments = useMemo(() => {
    return availableDocuments.filter((document) => {
      if (selectedDocIds.includes(document.id)) {
        return true;
      }

      if (selectedKbIds.length === 0) {
        return true;
      }

      return !!document.knowledge_base_id && selectedKbIds.includes(document.knowledge_base_id);
    });
  }, [availableDocuments, selectedDocIds, selectedKbIds]);

  const toggleDropdown = (id: string) => {
    setOpenDropdown((current) => (current === id ? null : id));
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length) {
      addImages(event.dataTransfer.files);
    }
  };

  const iconButtonClass =
    'rounded-xl px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 text-xs flex items-center gap-1.5';

  const selectedScopeSummary = (() => {
    if (selectedDocIds.length > 0) {
      return `已选 ${selectedDocIds.length} 个文件`;
    }
    if (selectedKbIds.length > 0) {
      return `已选 ${selectedKbIds.length} 个知识库`;
    }
    return '引用知识库';
  })();

  return (
    <div
      className={cn(
        'border-t border-slate-200 bg-white p-4 transition-colors',
        isDragging && 'border-slate-400 bg-slate-50',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mx-auto max-w-4xl">
        <AnimatePresence>
          {attachedImages.length ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex flex-wrap gap-2"
            >
              {attachedImages.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="group relative"
                >
                  <img
                    src={image.preview}
                    alt={`attachment-${index + 1}`}
                    className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isDragging ? (
          <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-400 py-4 text-sm text-slate-600">
            <ImageIcon className="h-5 w-5" />
            <span>释放图片即可附加到对话</span>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-300 bg-white transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-slate-900">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            placeholder={attachedImages.length ? '为图片补充说明或继续提问...' : placeholder}
            className="w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm focus:outline-none"
            rows={2}
            disabled={loading}
          />

          <div className="flex items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('model')}
                  className={iconButtonClass}
                  title="选择模型"
                >
                  <Cpu className="h-3 w-3" />
                  <span className="max-w-[140px] truncate">
                    {chatModels.find((model) => model.id === selectedModelId)?.model_name ||
                      chatModels.find((model) => model.is_default)?.model_name ||
                      '选择模型'}
                  </span>
                </button>

                <ToolbarDropdown
                  open={openDropdown === 'model'}
                  onClose={() => setOpenDropdown(null)}
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Chat Models
                  </div>
                  {chatModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onModelChange(model.id);
                        setOpenDropdown(null);
                        showToast(`已切换到 ${model.model_name}`);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                        model.id === selectedModelId && 'bg-slate-900 text-white',
                      )}
                    >
                      <span className="truncate">{model.model_name}</span>
                    </button>
                  ))}
                </ToolbarDropdown>
              </div>

              <button
                onClick={() => {
                  const nextMode = selectedMode === 'quick' ? 'strict' : 'quick';
                  onModeChange(nextMode);
                  showToast(
                    nextMode === 'strict'
                      ? '已切换到「严格模式」（更注重安全与一致性）'
                      : '已切换到「快速模式」（更偏向响应速度）',
                  );
                }}
                className={cn(iconButtonClass, selectedMode === 'strict' && 'bg-slate-900 text-white')}
                title={selectedMode === 'quick' ? '切换到严格模式' : '切换到快速模式'}
              >
                <Zap className="h-3 w-3" />
                <span>{selectedMode === 'quick' ? '快速' : '严格'}</span>
              </button>

              <button
                onClick={() => {
                  onAgentToggle(!useAgent);
                  showToast(
                    !useAgent ? 'Agent 模式已开启（多步推理与工具调用）' : 'Agent 模式已关闭',
                  );
                }}
                className={cn(iconButtonClass, useAgent && 'bg-slate-900 text-white')}
                title={useAgent ? '关闭 Agent 模式' : '开启 Agent 模式'}
              >
                <Bot className="h-3 w-3" />
                <span>Agent</span>
              </button>

              <button
                onClick={() => {
                  onWebSearchToggle(!enableWebSearch);
                  showToast(!enableWebSearch ? '联网搜索已开启' : '联网搜索已关闭');
                }}
                className={cn(iconButtonClass, enableWebSearch && 'bg-slate-900 text-white')}
                title={enableWebSearch ? '关闭联网搜索' : '开启联网搜索'}
              >
                <Globe className="h-3 w-3" />
                <span>网络</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('kb')}
                  className={cn(
                    iconButtonClass,
                    (openDropdown === 'kb' || selectedKbIds.length > 0 || selectedDocIds.length > 0) &&
                      'bg-slate-900 text-white',
                  )}
                  title={selectedScopeSummary}
                >
                  <BookOpen className="h-3 w-3" />
                  <span>知识库</span>
                </button>

                <ToolbarDropdown open={openDropdown === 'kb'} onClose={() => setOpenDropdown(null)}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Knowledge Bases
                  </div>

                  {kbSelectorLoading ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">正在加载知识库...</div>
                  ) : knowledgeBases.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">暂无可用知识库</div>
                  ) : (
                    knowledgeBases.map((kb) => {
                      const isSelected = selectedKbIds.includes(kb.id);

                      return (
                        <button
                          key={kb.id}
                          onClick={() => onKbToggle(kb.id)}
                          className={cn(
                            'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                              isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300',
                            )}
                          >
                            {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{kb.name}</p>
                              <span
                                className={cn(
                                  'inline-flex flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                  isSelected
                                    ? 'bg-white/15 text-slate-100'
                                    : 'bg-slate-100 text-slate-500',
                                )}
                              >
                                {kb.document_count ?? 0}
                              </span>
                            </div>
                            <p className={cn('text-[10px]', isSelected ? 'text-slate-200' : 'text-slate-400')}>
                              {kb.kb_type === 'document' ? 'Document KB' : 'FAQ KB'}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}

                  <div className="mt-1 border-t border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Files
                  </div>

                  {!kbSelectorLoading && visibleDocuments.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">
                      {selectedKbIds.length > 0 ? '当前知识库下暂无可引用文件' : '暂无可引用文件'}
                    </div>
                  ) : null}

                  {!kbSelectorLoading && visibleDocuments.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      {visibleDocuments.map((document) => {
                        const isSelected = selectedDocIds.includes(document.id);
                        const kbName = document.knowledge_base_id
                          ? documentKbNameMap.get(document.knowledge_base_id) ?? '未分组'
                          : '未分组';

                        return (
                          <button
                            key={document.id}
                            onClick={() => onDocumentToggle(document.id)}
                            className={cn(
                              'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-emerald-50 text-emerald-900'
                                : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            <div
                              className={cn(
                                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                                isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300',
                              )}
                            >
                              {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                            </div>
                            <FileText
                              className={cn(
                                'h-4 w-4 flex-shrink-0',
                                isSelected ? 'text-emerald-700' : 'text-slate-400',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{document.title}</p>
                              <p
                                className={cn(
                                  'mt-0.5 truncate text-[11px]',
                                  isSelected ? 'text-emerald-700' : 'text-slate-400',
                                )}
                              >
                                {kbName}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mt-1 border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                    {selectedDocIds.length > 0
                      ? `当前已选择 ${selectedDocIds.length} 个文件，将优先限定到这些文件`
                      : selectedKbIds.length === 0
                        ? '未选择时默认检索全部知识库'
                        : `当前已选择 ${selectedKbIds.length} 个知识库`}
                  </div>
                </ToolbarDropdown>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) {
                    addImages(event.target.files);
                  }
                  event.target.value = '';
                }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className={iconButtonClass}
                title="上传图片"
                disabled={loading}
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <button
                onClick={handleStop}
                className="rounded-2xl bg-slate-700 p-2 text-white transition-colors hover:bg-slate-800"
                title="停止生成"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && attachedImages.length === 0}
                className="rounded-2xl bg-slate-900 p-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-slate-400">
          {placeholder} · 支持粘贴截图、拖拽图片和上传图片
          {attachedImages.length ? `（已添加 ${attachedImages.length}/5 张图片）` : ''}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-3xl', isUser ? 'w-auto' : 'w-full')}>
        {isUser ? (
          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
            {(() => {
              const previews = message._imagePreviews;
              const dbImages = message.images_json;
              const imageSources = previews?.length
                ? previews
                : dbImages?.length
                  ? dbImages.map((base64) =>
                      base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`,
                    )
                  : [];

              if (!imageSources.length) {
                return null;
              }

              return (
                <div className="mb-2 flex flex-wrap gap-2">
                  {imageSources.map((src, index) => (
                    <img
                      key={index}
                      src={src}
                      alt=""
                      className="h-24 w-24 rounded-lg border border-white/10 object-cover"
                    />
                  ))}
                </div>
              );
            })()}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <AnswerMessage content={message.content} citations={message.citations_json} />
        )}
      </div>
    </motion.div>
  );
}
