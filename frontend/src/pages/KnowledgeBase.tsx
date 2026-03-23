import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, FileText, HelpCircle, ChevronRight, Loader2, Search, ArrowLeft,
  Upload, Trash2, RefreshCw, GraduationCap,
  Database, X, Link2, AlertTriangle, Globe, MoreVertical
} from 'lucide-react';
import { kbAPI } from '../services/api';
import type {
  KnowledgeBaseItem, Document, FAQEntry,
  KBSearchResult, KBSearchChunkItem, KBSearchFAQItem
} from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';
import DocumentDetail from './DocumentDetail';
import FAQManager from './FAQManager';

// ======================== 知识库列表 ========================

function KBListView({
  onSelect,
  onCreate: _onCreate,
}: {
  onSelect: (kb: KnowledgeBaseItem) => void;
  onCreate: () => void;
}) {
  const [list, setList] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTags, setCreateTags] = useState('');
  const [createType, setCreateType] = useState<'document' | 'faq'>('document');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteKb, setConfirmDeleteKb] = useState<KnowledgeBaseItem | null>(null);

  const loadList = useCallback(async () => {
    try {
      const data = await kbAPI.listKnowledgeBases();
      setList(data);
    } catch (e) {
      console.error('Failed to load knowledge bases:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) { alert('请输入知识库名称'); return; }
    setCreating(true);
    try {
      await kbAPI.createKnowledgeBase({
        name,
        tags: createTags ? createTags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined,
        kb_type: createType,
      });
      setShowCreateModal(false);
      setCreateName('');
      setCreateTags('');
      setCreateType('document');
      await loadList();
    } catch (e) {
      console.error('Create KB failed:', e);
      alert('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKb = async () => {
    if (!confirmDeleteKb) return;
    setDeletingId(confirmDeleteKb.id);
    try {
      await kbAPI.deleteKnowledgeBase(confirmDeleteKb.id);
      setConfirmDeleteKb(null);
      await loadList();
    } catch (e) {
      console.error('Delete KB failed:', e);
      alert('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-8 pt-4 pb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          知识库
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors"
        >
          <Plus className="h-5 w-5" />
          新建知识库
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Database className="h-14 w-14 mx-auto mb-4 text-slate-300" />
            <p className="mb-2">暂无知识库</p>
            <p className="text-sm">点击「新建知识库」创建第一个知识库</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium"
            >
              <Plus className="h-4 w-4" /> 新建知识库
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((kb, index) => (
              <motion.div
                key={kb.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
                  "hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative"
                )}
              >
                <div onClick={() => onSelect(kb)} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {kb.kb_type === 'document' ? (
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <HelpCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-slate-900 truncate">{kb.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {kb.kb_type === 'document' ? '文档型' : '问答型'}
                      {kb.kb_type === 'document'
                        ? ` · ${kb.document_count ?? 0} 个文档`
                        : ` · ${kb.faq_count ?? 0} 条问答`}
                    </p>
                    {kb.tags && kb.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {kb.tags.slice(0, 4).map((t, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                </div>
                {/* 知识库删除按钮 */}
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDeleteKb(kb); }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="删除知识库"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 新建知识库弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <ModalOverlay onClose={() => !creating && setShowCreateModal(false)}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">新建知识库</h2>
              <button onClick={() => !creating && setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">名称</label>
                <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                  placeholder="例如：产品手册" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">标签（可选，逗号分隔）</label>
                <input type="text" value={createTags} onChange={e => setCreateTags(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                  placeholder="安全, 文档, 指南" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">类型</label>
                <div className="flex gap-3">
                  <label className={cn("flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors",
                    createType === 'document' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50")}>
                    <input type="radio" name="kbType" checked={createType === 'document'} onChange={() => setCreateType('document')} className="sr-only" />
                    <FileText className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">文档型</span>
                  </label>
                  <label className={cn("flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors",
                    createType === 'faq' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50")}>
                    <input type="radio" name="kbType" checked={createType === 'faq'} onChange={() => setCreateType('faq')} className="sr-only" />
                    <HelpCircle className="h-5 w-5 text-emerald-600" /><span className="text-sm font-medium">问答型</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => !creating && setShowCreateModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
              <button onClick={handleCreate} disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}创建
              </button>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* 确认删除知识库弹窗 */}
      <AnimatePresence>
        {confirmDeleteKb && (
          <ModalOverlay onClose={() => !deletingId && setConfirmDeleteKb(null)}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">删除知识库</h3>
              <p className="text-sm text-slate-500 mb-1">确定要删除知识库「{confirmDeleteKb.name}」吗？</p>
              <p className="text-xs text-red-500 mb-6">此操作不可撤销，关联的文档和问答数据将被移除。</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmDeleteKb(null)} disabled={!!deletingId}
                  className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
                <button onClick={handleDeleteKb} disabled={!!deletingId}
                  className="px-5 py-2 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                  {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  确认删除
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================== 知识库详情 ========================

function KBDetailView({
  kb,
  onBack,
  onRefreshList: _onRefreshList,
}: {
  kb: KnowledgeBaseItem;
  onBack: () => void;
  onRefreshList: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await kbAPI.searchKnowledgeBase(kb.id, q, 20);
      setSearchResults(res);
    } catch (e) {
      console.error('Search failed:', e);
      setSearchResults({ chunks: [], faq: [] });
    } finally { setSearching(false); }
  }, [kb.id, searchQuery]);

  useEffect(() => { if (!searchQuery.trim()) setSearchResults(null); }, [searchQuery]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [_faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [learningId, setLearningId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<Document | null>(null);
  const [docMenuOpenId, setDocMenuOpenId] = useState<string | null>(null);
  const [faqImporting, setFaqImporting] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingIdsRef = useRef<string[]>([]);
  const docMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as Node)) {
        setDocMenuOpenId(null);
      }
    };
    if (docMenuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [docMenuOpenId]);

  const loadDocs = useCallback(async () => {
    if (kb.kb_type === 'document') {
      setLoadingDocs(true);
      try {
        const docs = await kbAPI.listDocuments(0, 100, kb.id);
        setDocuments(docs);
      } catch (e) { console.error('Load documents failed:', e); }
      finally { setLoadingDocs(false); }
    } else {
      setLoadingDocs(true);
      try {
        const list = await kbAPI.listFAQ(0, 100, kb.id);
        setFaqs(list);
      } catch (e) { console.error('Load FAQ failed:', e); }
      finally { setLoadingDocs(false); }
    }
  }, [kb.id, kb.kb_type]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const isParsingDocument = useCallback((doc: Document) => (
    ['pending', 'processing'].includes(doc.parse_status)
  ), []);

  const isSummarizingDocument = useCallback((doc: Document) => (
    doc.parse_status === 'completed' && ['pending', 'processing'].includes(doc.summary_status)
  ), []);

  const isDocumentBusy = useCallback((doc: Document) => (
    isParsingDocument(doc) || isSummarizingDocument(doc)
  ), [isParsingDocument, isSummarizingDocument]);

  const getDocumentStatusText = useCallback((doc: Document) => {
    if (isParsingDocument(doc)) {
      return '解析中...';
    }
    if (isSummarizingDocument(doc)) {
      return '生成摘要中...';
    }
    if (doc.status === 'failed' || doc.parse_status === 'failed') {
      return '解析失败';
    }
    if (doc.summary_status === 'failed') {
      return '摘要生成失败';
    }
    return '';
  }, [isParsingDocument, isSummarizingDocument]);

  // Auto-poll documents still in parse/summary pipeline.
  useEffect(() => {
    const processingIds = documents.filter(isDocumentBusy).map(doc => doc.id);
    processingIdsRef.current = processingIds;
    const hasProcessing = processingIds.length > 0;
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          if (!processingIdsRef.current.length) {
            return;
          }
          const latestDocuments = await kbAPI.batchGetDocuments(processingIdsRef.current);
          if (!latestDocuments.length) {
            return;
          }
          setDocuments(currentDocuments => {
            const latestById = new Map(latestDocuments.map(doc => [doc.id, doc]));
            return currentDocuments.map(doc => latestById.get(doc.id) ?? doc);
          });
          if (!latestDocuments.some(isDocumentBusy) && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } catch { /* ignore */ }
      }, 1500);
    }
    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [documents, isDocumentBusy]);

  const handleLearn = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLearningId(id);
    try {
      await kbAPI.learnDocument(id);
      await loadDocs();
    } catch (err: unknown) {
      console.error('Learn failed:', err);
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动学习失败，请重试');
    } finally { setLearningId(null); }
  };

  const handleDeleteDoc = async () => {
    if (!confirmDeleteDoc) return;
    setDeletingDocId(confirmDeleteDoc.id);
    try {
      await kbAPI.deleteDocument(confirmDeleteDoc.id);
      setConfirmDeleteDoc(null);
      await loadDocs();
    } catch (e) {
      console.error('Delete failed:', e);
      alert('删除失败');
    } finally { setDeletingDocId(null); }
  };

  if (selectedDoc) {
    return <DocumentDetail document={selectedDoc} onBack={() => { setSelectedDoc(null); loadDocs(); }} />;
  }

  const getFileFormatLabel = (doc: Document): string => {
    if (doc.source_type === 'url') return '链接';
    const m = (doc.mime_type || '').toLowerCase();
    if (m.includes('pdf')) return 'PDF';
    if (m.includes('markdown') || m.includes('md')) return 'MD';
    if (m.includes('plain') || m.includes('text')) return 'TXT';
    if (m.includes('html')) return 'HTML';
    if (m.includes('word') || m.includes('document')) return 'DOCX';
    if (m.includes('sheet') || m.includes('excel')) return 'XLSX';
    if (m.includes('presentation') || m.includes('powerpoint')) return 'PPTX';
    if (m.includes('csv')) return 'CSV';
    return (doc.mime_type || '文件').split('/').pop()?.toUpperCase().slice(0, 4) || '文件';
  };

  const formatUploadTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear().toString().slice(-2);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${y}-${month}-${day} ${h}:${min}`;
  };

  const stripFileExtension = (title: string): string => {
    if (!title) return title;
    const ext = title.match(/\.(pdf|txt|md|html?|docx?|xlsx?|pptx?|csv|json|xml)$/i);
    return ext ? title.slice(0, -ext[0].length) : title;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-4 pb-2 border-b border-slate-200">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{kb.name}</h1>
          <p className="text-sm text-slate-500">
            {kb.kb_type === 'document' ? '文档型' : '问答型'}
            {kb.tags && kb.tags.length > 0 && ` · ${kb.tags.join('、')}`}
          </p>
        </div>
        {kb.kb_type === 'document' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUrlImport(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors">
              <Link2 className="h-4 w-4" /> 导入链接
            </button>
            <UploadDocumentButton kbId={kb.id} onUploaded={loadDocs} />
          </div>
        )}
        {kb.kb_type === 'faq' && (
          <label className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors',
            faqImporting && 'opacity-50 pointer-events-none'
          )}>
            {faqImporting ? <Loader2 className="h-4 w-4 animate-spin text-slate-600" /> : <Upload className="h-4 w-4 text-slate-600" />}
            {faqImporting ? '导入中...' : '导入 CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setFaqImporting(true);
              try {
                const result = await kbAPI.importFAQCSV(file, kb.id);
                alert(`成功导入 ${result.imported} 条问答`);
                loadDocs();
              } catch { alert('CSV 导入失败，请检查文件格式'); }
              finally { setFaqImporting(false); e.target.value = ''; }
            }} />
          </label>
        )}
      </div>

      {/* Search */}
      <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="输入关键词搜索知识库内容"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <button onClick={runSearch} disabled={searching}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}搜索
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* Search results */}
        {searchResults !== null && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">搜索结果</h2>
            {searchResults.chunks.length === 0 && searchResults.faq.length === 0 ? (
              <p className="text-slate-500 text-sm">未找到匹配内容</p>
            ) : (
              <div className="space-y-3">
                {searchResults.chunks.map((c: KBSearchChunkItem) => (
                  <div key={c.chunk_id} className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">文档：{c.document_title} · 片段 #{c.chunk_index + 1}</p>
                    <p className="text-sm text-slate-800 line-clamp-3">{c.snippet}</p>
                  </div>
                ))}
                {searchResults.faq.map((f: KBSearchFAQItem) => (
                  <div key={f.faq_id} className="p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-sm font-medium text-slate-800 mb-1">Q: {f.question}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{f.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Document list */}
        {kb.kb_type === 'document' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                文档列表
                <span className="ml-2 text-sm font-normal text-slate-400">({documents.length})</span>
              </h2>
              <button onClick={loadDocs} className="p-2 hover:bg-slate-100 rounded-lg" title="刷新">
                <RefreshCw className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            {loadingDocs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="mb-1">暂无文档</p>
                <p className="text-sm text-slate-400 mb-4">上传文档或导入链接后，系统会自动开始学习和向量化</p>
                <div className="flex justify-center gap-3">
                  <UploadDocumentButton kbId={kb.id} onUploaded={loadDocs} />
                  <button onClick={() => setShowUrlImport(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium">
                    <Link2 className="h-4 w-4" /> 导入链接
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-green-200 hover:shadow-md transition-all cursor-pointer group min-h-[140px]"
                  >
                    {/* 右上角三点菜单 */}
                    <div
                      className="absolute top-2 right-2 z-10"
                      ref={docMenuOpenId === doc.id ? docMenuRef : undefined}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDocMenuOpenId(prev => prev === doc.id ? null : doc.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="更多操作"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {docMenuOpenId === doc.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50"
                          >
                            {doc.parse_status === 'completed' && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleLearn(doc.id, e);
                                  setDocMenuOpenId(null);
                                }}
                                disabled={learningId === doc.id}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {learningId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                                重新学习
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setConfirmDeleteDoc(doc);
                                setDocMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              删除
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 文件名称（不含后缀） */}
                    <h3 className="pr-7 font-semibold text-slate-900 truncate text-sm mb-1.5" title={doc.title}>
                      {stripFileExtension(doc.title)}
                    </h3>
                    {/* 文件摘要 / 学习状态 */}
                    <div className="flex-1 min-h-0 flex items-center">
                      {isDocumentBusy(doc) ? (
                        <p className="text-sm text-slate-500 flex items-center gap-1.5">
                          <Loader2 className="h-4 w-4 animate-spin text-green-500 flex-shrink-0" />
                          {getDocumentStatusText(doc)}
                        </p>
                      ) : getDocumentStatusText(doc) ? (
                        <p className="text-sm text-red-500 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
                          {getDocumentStatusText(doc)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {doc.summary || (doc.source_type === 'url' ? '链接导入的文档' : '暂无摘要')}
                        </p>
                      )}
                    </div>
                    {/* 上传时间、文档分类、右下角文件类型 */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 flex-shrink-0">
                        {formatUploadTime(doc.created_at)}
                      </span>
                      {(doc.tags?.length ? doc.tags : [kb.name]).slice(0, 2).map((tag, i) => (
                        <span key={i} className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {tag}
                        </span>
                      ))}
                      <span className="ml-auto inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {getFileFormatLabel(doc)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FAQ list */}
        {kb.kb_type === 'faq' && (
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">问答列表</h2>
            <FAQManager knowledgeBaseId={kb.id} onListChange={loadDocs} />
          </div>
        )}
      </div>

      {/* URL import dialog */}
      <AnimatePresence>
        {showUrlImport && (
          <UrlImportDialog kbId={kb.id} onClose={() => setShowUrlImport(false)} onImported={loadDocs} />
        )}
      </AnimatePresence>

      {/* Confirm delete document dialog */}
      <AnimatePresence>
        {confirmDeleteDoc && (
          <ModalOverlay onClose={() => !deletingDocId && setConfirmDeleteDoc(null)}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">删除文档</h3>
              <p className="text-sm text-slate-500 mb-1">确定要删除文档「{confirmDeleteDoc.title}」吗？</p>
              <p className="text-xs text-red-500 mb-6">文档及其分块数据、向量索引将被移除。</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmDeleteDoc(null)} disabled={!!deletingDocId}
                  className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
                <button onClick={handleDeleteDoc} disabled={!!deletingDocId}
                  className="px-5 py-2 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                  {deletingDocId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  确认删除
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================== URL 导入弹窗 ========================

function UrlImportDialog({
  kbId,
  onClose,
  onImported,
}: {
  kbId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) { alert('请输入 URL'); return; }
    if (!/^https?:\/\//i.test(trimmedUrl)) { alert('请输入有效的 URL（以 http:// 或 https:// 开头）'); return; }
    setImporting(true);
    try {
      await kbAPI.importUrl(trimmedUrl, title.trim() || undefined, undefined, kbId);
      onClose();
      onImported();
    } catch (e: any) {
      console.error('URL import failed:', e);
      const detail = e?.response?.data?.detail;
      alert(detail || '导入失败，请检查 URL 是否可访问');
    } finally { setImporting(false); }
  };

  return (
    <ModalOverlay onClose={() => !importing && onClose()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-cyan-600" />
          导入链接
        </h2>
        <button onClick={() => !importing && onClose()} className="p-1 hover:bg-slate-100 rounded-lg">
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">输入公开网页 URL，系统将自动抓取正文内容并存入知识库。</p>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">网页 URL</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">标题（可选，不填则使用 URL）</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="自定义标题"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm" />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={() => !importing && onClose()} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
        <button onClick={handleImport} disabled={importing}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {importing ? '导入中...' : '开始导入'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ======================== 上传文档按钮 ========================

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf', '.html', '.htm', '.docx', '.xlsx', '.csv', '.pptx'];
const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.join(',');

function UploadDocumentButton({ kbId, onUploaded }: { kbId: string; onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        alert(`不支持的格式「${ext}」，仅允许：${ALLOWED_EXTENSIONS.join('、')}`);
        e.target.value = '';
        return;
      }
      setFile(f);
      if (!title) setTitle(f.name);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await kbAPI.uploadDocument(file, title || undefined, tags || undefined, kbId);
      setOpen(false);
      setFile(null);
      setTitle('');
      setTags('');
      onUploaded();
    } catch (e: any) {
      console.error('Upload failed:', e);
      const detail = e?.response?.data?.detail;
      alert(detail || '上传失败');
    } finally { setUploading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
        <Upload className="h-4 w-4" /> 上传文档
      </button>
      <AnimatePresence>
        {open && (
          <ModalOverlay onClose={() => !uploading && setOpen(false)}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                上传文档
              </h3>
              <button onClick={() => !uploading && setOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              支持格式：{ALLOWED_EXTENSIONS.join('、')}
            </p>
            <input type="file" onChange={onFileChange} accept={ALLOWED_ACCEPT}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:cursor-pointer" />
            {file && (
              <>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="标题" className="mt-3 w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm" />
                <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="标签（逗号分隔，可选）" className="mt-2 w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm" />
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => !uploading && setOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
                  <button onClick={handleUpload} disabled={uploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}上传
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}
      </AnimatePresence>
    </>
  );
}

// ======================== 通用 Modal Overlay ========================

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ======================== 入口 ========================

export default function KnowledgeBase() {
  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseItem | null>(null);
  const [_listVersion, setListVersion] = useState(0);
  const refreshList = useCallback(() => { setListVersion(v => v + 1); }, []);

  if (selectedKb) {
    return <KBDetailView kb={selectedKb} onBack={() => setSelectedKb(null)} onRefreshList={refreshList} />;
  }

  return <KBListView onSelect={setSelectedKb} onCreate={refreshList} />;
}
