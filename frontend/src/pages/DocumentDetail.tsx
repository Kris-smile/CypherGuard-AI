import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, FileText, Brain, Blocks, Shield, Loader2,
  ToggleLeft, ToggleRight, Edit3, Save, X, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { kbAPI } from '../services/api';
import type { Document, ChunkInfo, EntityInfo } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

type TabType = 'summary' | 'chunks' | 'entities';

interface Props {
  document: Document;
  onBack: () => void;
}

export default function DocumentDetail({ document: doc, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const loadChunks = useCallback(async () => {
    setLoadingChunks(true);
    try {
      const data = await kbAPI.listChunks(doc.id);
      setChunks(data);
    } catch (e) {
      console.error('Failed to load chunks:', e);
    } finally {
      setLoadingChunks(false);
    }
  }, [doc.id]);

  const loadEntities = useCallback(async () => {
    setLoadingEntities(true);
    try {
      const data = await kbAPI.listEntities(doc.id);
      setEntities(data);
    } catch (e) {
      console.error('Failed to load entities:', e);
    } finally {
      setLoadingEntities(false);
    }
  }, [doc.id]);

  useEffect(() => {
    if (activeTab === 'chunks' && chunks.length === 0) loadChunks();
    if (activeTab === 'entities' && entities.length === 0) loadEntities();
  }, [activeTab, chunks.length, entities.length, loadChunks, loadEntities]);

  const handleToggleChunk = async (chunk: ChunkInfo) => {
    try {
      await kbAPI.toggleChunk(chunk.id);
      await loadChunks();
    } catch (e) {
      console.error('Toggle chunk failed:', e);
    }
  };

  const handleSaveChunk = async (chunkId: string) => {
    try {
      await kbAPI.updateChunk(chunkId, { text: editText });
      setEditingChunkId(null);
      setEditText('');
      await loadChunks();
    } catch (e) {
      console.error('Save chunk failed:', e);
      alert('保存失败');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'summary', label: '文档摘要', icon: Brain },
    { id: 'chunks', label: 'Chunk 管理', icon: Blocks, count: chunks.length },
    { id: 'entities', label: '安全实体', icon: Shield, count: entities.length },
  ];

  const entityTypeLabel: Record<string, string> = {
    cve: 'CVE 漏洞', ip: 'IP 地址', domain: '域名', hash: 'Hash 值', email: '邮箱', url: 'URL'
  };

  const entityTypeColor: Record<string, string> = {
    cve: 'bg-red-50 text-red-700 border-red-200',
    ip: 'bg-blue-50 text-blue-700 border-blue-200',
    domain: 'bg-purple-50 text-purple-700 border-purple-200',
    hash: 'bg-amber-50 text-amber-700 border-amber-200',
    email: 'bg-green-50 text-green-700 border-green-200',
    url: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };

  const isParsing = ['pending', 'processing'].includes(doc.parse_status);
  const isSummarizing = doc.parse_status === 'completed' && ['pending', 'processing'].includes(doc.summary_status);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-slate-200 bg-white">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-slate-900 truncate">{doc.title}</h2>
            <p className="text-xs text-slate-500">{doc.mime_type} · {new Date(doc.created_at).toLocaleDateString('zh-CN')}</p>
          </div>
        </div>
        {doc.tags && doc.tags.length > 0 && (
          <div className="flex gap-1.5">
            {doc.tags.map((tag, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-8 py-3 bg-white border-b border-slate-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full ml-1">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI 自动摘要
              </h3>
              {isParsing ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="h-10 w-10 mx-auto mb-3 opacity-70 animate-spin" />
                  <p>文档解析中，摘要将在解析完成后生成。</p>
                </div>
              ) : isSummarizing ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="h-10 w-10 mx-auto mb-3 opacity-70 animate-spin" />
                  <p>正在生成摘要，请稍后刷新查看。</p>
                </div>
              ) : doc.summary ? (
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{doc.summary}</p>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Brain className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>暂无摘要。文档处理完成后将自动生成。</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'chunks' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">共 {chunks.length} 个文本块</p>
              <button onClick={loadChunks} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
            </div>

            {loadingChunks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : chunks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Blocks className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>暂无 Chunk 数据</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chunks.map((chunk) => {
                  const isExpanded = expandedChunks.has(chunk.id);
                  const isEditing = editingChunkId === chunk.id;
                  return (
                    <div
                      key={chunk.id}
                      className={cn(
                        "bg-white rounded-xl border p-4 transition-all",
                        chunk.is_enabled ? "border-slate-200" : "border-orange-200 bg-orange-50/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            #{chunk.chunk_index}
                          </span>
                          {chunk.section_title && (
                            <span className="text-xs text-slate-500">{chunk.section_title}</span>
                          )}
                          {chunk.page_start !== null && chunk.page_start !== undefined && (
                            <span className="text-xs text-slate-400">第 {chunk.page_start} 页</span>
                          )}
                          {!chunk.is_enabled && (
                            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">已禁用</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleToggleChunk(chunk)} className="p-1.5 hover:bg-slate-100 rounded-lg" title={chunk.is_enabled ? '禁用' : '启用'}>
                            {chunk.is_enabled
                              ? <ToggleRight className="h-4 w-4 text-green-500" />
                              : <ToggleLeft className="h-4 w-4 text-slate-400" />
                            }
                          </button>
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveChunk(chunk.id)} className="p-1.5 hover:bg-green-50 rounded-lg">
                                <Save className="h-4 w-4 text-green-600" />
                              </button>
                              <button onClick={() => { setEditingChunkId(null); setEditText(''); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                <X className="h-4 w-4 text-slate-400" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => { setEditingChunkId(chunk.id); setEditText(chunk.text || ''); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                              <Edit3 className="h-4 w-4 text-slate-500" />
                            </button>
                          )}
                          <button onClick={() => toggleExpand(chunk.id)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={8}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 resize-y font-mono"
                        />
                      ) : (
                        <AnimatePresence initial={false}>
                          <motion.div
                            animate={{ height: isExpanded ? 'auto' : '4rem' }}
                            className="overflow-hidden"
                          >
                            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
                              {chunk.text || '（空内容）'}
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'entities' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {loadingEntities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : entities.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>暂无安全实体。文档处理完成后将自动抽取。</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(
                    entities.reduce<Record<string, number>>((acc, e) => {
                      acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([type, count]) => (
                    <div key={type} className={cn("rounded-xl border p-3 text-center", entityTypeColor[type] || "bg-slate-50 text-slate-700 border-slate-200")}>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs font-medium mt-1">{entityTypeLabel[type] || type}</div>
                    </div>
                  ))}
                </div>

                {/* Entity List */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">类型</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">值</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">出现次数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entities.map(entity => (
                        <tr key={entity.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", entityTypeColor[entity.entity_type] || "bg-slate-50 text-slate-600 border-slate-200")}>
                              {entityTypeLabel[entity.entity_type] || entity.entity_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800 break-all">{entity.value}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{entity.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
