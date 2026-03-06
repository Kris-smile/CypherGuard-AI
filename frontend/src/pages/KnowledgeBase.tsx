import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, FileText, HelpCircle, Tag, ChevronRight, Loader2, Search, ArrowLeft,
  Upload, Trash2, RefreshCw, CheckCircle, XCircle, Clock, GraduationCap, Sparkles,
  Database, X
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

// 知识库列表：卡片 + 新建
function KBListView({
  onSelect,
  onCreate,
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
    if (!name) {
      alert('请输入知识库名称');
      return;
    }
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
            <p className="text-sm">点击「新建知识库」创建第一个知识库，可设置名称、标签与类型（文档型/问答型）</p>
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
                onClick={() => onSelect(kb)}
                className={cn(
                  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
                  "hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                )}
              >
                <div className="flex items-start justify-between gap-2">
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
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 新建知识库弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => !creating && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">新建知识库</h2>
                <button onClick={() => !creating && setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">名称</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                    placeholder="例如：产品手册"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">标签（可选，逗号分隔）</label>
                  <input
                    type="text"
                    value={createTags}
                    onChange={e => setCreateTags(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                    placeholder="安全, 文档, 指南"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">类型</label>
                  <div className="flex gap-3">
                    <label className={cn(
                      "flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors",
                      createType === 'document' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <input type="radio" name="kbType" checked={createType === 'document'} onChange={() => setCreateType('document')} className="sr-only" />
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium">文档型</span>
                    </label>
                    <label className={cn(
                      "flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors",
                      createType === 'faq' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"
                    )}>
                      <input type="radio" name="kbType" checked={createType === 'faq'} onChange={() => setCreateType('faq')} className="sr-only" />
                      <HelpCircle className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium">问答型</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => !creating && setShowCreateModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 知识库详情：关键词搜索 + 文档/FAQ 内容
function KBDetailView({
  kb,
  onBack,
  onRefreshList,
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
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await kbAPI.searchKnowledgeBase(kb.id, q, 20);
      setSearchResults(res);
    } catch (e) {
      console.error('Search failed:', e);
      setSearchResults({ chunks: [], faq: [] });
    } finally {
      setSearching(false);
    }
  }, [kb.id, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) setSearchResults(null);
  }, [searchQuery]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [learningId, setLearningId] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    if (kb.kb_type === 'document') {
      setLoadingDocs(true);
      try {
        const docs = await kbAPI.listDocuments(0, 100, kb.id);
        setDocuments(docs);
      } catch (e) {
        console.error('Load documents failed:', e);
      } finally {
        setLoadingDocs(false);
      }
    } else {
      setLoadingDocs(true);
      try {
        const list = await kbAPI.listFAQ(0, 100, kb.id);
        setFaqs(list);
      } catch (e) {
        console.error('Load FAQ failed:', e);
      } finally {
        setLoadingDocs(false);
      }
    }
  }, [kb.id, kb.kb_type]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleLearn = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLearningId(id);
    try {
      await kbAPI.learnDocument(id);
      await loadDocs();
    } catch (err: unknown) {
      console.error('Learn failed:', err);
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动学习失败，请重试');
    } finally {
      setLearningId(null);
    }
  };

  if (selectedDoc) {
    return (
      <DocumentDetail
        document={selectedDoc}
        onBack={() => {
          setSelectedDoc(null);
          loadDocs();
        }}
      />
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return '已学习';
      case 'failed': return '学习失败';
      case 'processing': return '学习中';
      default: return '待学习';
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-50 text-green-700 border-green-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <div className="h-full flex flex-col">
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
      </div>

      {/* 关键词搜索 */}
      <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="输入关键词搜索知识库内容"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <button
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            搜索
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* 搜索结果区 */}
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

        {/* 内容列表：文档型 */}
        {kb.kb_type === 'document' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">文档列表</h2>
              <div className="flex items-center gap-2">
                <button onClick={loadDocs} className="p-2 hover:bg-slate-100 rounded-lg">
                  <RefreshCw className="h-4 w-4 text-slate-600" />
                </button>
                <UploadDocumentButton kbId={kb.id} onUploaded={loadDocs} />
              </div>
            </div>
            {loadingDocs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>暂无文档，请上传</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{doc.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-400">{doc.mime_type}</span>
                          <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border', getStatusColor(doc.status))}>
                        {getStatusIcon(doc.status)}
                        {getStatusLabel(doc.status)}
                      </div>
                      {(doc.status === 'pending' || doc.status === 'failed') && (
                        <button
                          onClick={e => handleLearn(doc.id, e)}
                          disabled={learningId === doc.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          title="学习：解析、分块、向量化"
                        >
                          {learningId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
                          {learningId === doc.id ? '学习中...' : '学习'}
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 内容列表：问答型 */}
        {kb.kb_type === 'faq' && (
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">问答列表</h2>
            <FAQManager knowledgeBaseId={kb.id} onListChange={loadDocs} />
          </div>
        )}
      </div>
    </div>
  );
}

// 上传文档按钮（内联上传表单或弹窗）
function UploadDocumentButton({ kbId, onUploaded }: { kbId: string; onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const ALLOWED_EXTENSIONS = ['.md', '.pdf', '.html', '.htm'];

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        alert(`仅支持 ${ALLOWED_EXTENSIONS.join('、')}`);
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
    } catch (e) {
      console.error('Upload failed:', e);
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
        <Upload className="h-4 w-4" /> 上传文档
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !uploading && setOpen(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="font-bold text-slate-900 mb-4">上传文档</h3>
              <input type="file" onChange={onFileChange} accept=".md,.pdf,.html,.htm" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
              {file && (
                <>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="标题" className="mt-3 w-full px-4 py-2 border rounded-xl text-sm" />
                  <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="标签（逗号分隔）" className="mt-2 w-full px-4 py-2 border rounded-xl text-sm" />
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => !uploading && setOpen(false)} className="px-4 py-2 text-slate-600 rounded-xl">取消</button>
                    <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-xl disabled:opacity-50 flex items-center gap-2">
                      {uploading && <Loader2 className="h-4 w-4 animate-spin" />} 上传
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function KnowledgeBase() {
  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseItem | null>(null);
  const [listVersion, setListVersion] = useState(0);

  const refreshList = useCallback(() => { setListVersion(v => v + 1); }, []);

  if (selectedKb) {
    return (
      <KBDetailView
        kb={selectedKb}
        onBack={() => setSelectedKb(null)}
        onRefreshList={refreshList}
      />
    );
  }

  return <KBListView onSelect={setSelectedKb} onCreate={refreshList} />;
}
