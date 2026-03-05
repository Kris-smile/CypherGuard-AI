import React, { useState, useEffect } from 'react';
import {
  Upload, FileText, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  Loader2, Database, HelpCircle, Tag, Eye, ChevronRight
} from 'lucide-react';
import { kbAPI } from '../services/api';
import type { Document } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';
import FAQManager from './FAQManager';
import TagManager from './TagManager';
import DocumentDetail from './DocumentDetail';

type KBTab = 'documents' | 'faq' | 'tags';

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<KBTab>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => { loadDocuments(); }, []);

  const loadDocuments = async () => {
    try {
      const docs = await kbAPI.listDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) setTitle(file.name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await kbAPI.uploadDocument(selectedFile, title, tags);
      setSelectedFile(null);
      setTitle('');
      setTags('');
      await loadDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败，请重试。');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个文档吗？')) return;
    try {
      await kbAPI.deleteDocument(id);
      await loadDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

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
      case 'ready': return '已就绪';
      case 'failed': return '失败';
      case 'processing': return '处理中';
      default: return '等待中';
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

  if (selectedDoc) {
    return <DocumentDetail document={selectedDoc} onBack={() => { setSelectedDoc(null); loadDocuments(); }} />;
  }

  const kbTabs: { id: KBTab; label: string; icon: React.ElementType }[] = [
    { id: 'documents', label: '文档管理', icon: FileText },
    { id: 'faq', label: 'FAQ 管理', icon: HelpCircle },
    { id: 'tags', label: '标签管理', icon: Tag },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex gap-1 px-8 pt-4 pb-2">
        {kbTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <AnimatePresence mode="wait">
          {activeTab === 'documents' && (
            <motion.div key="documents" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              {/* Upload Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  上传文档
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">选择文件</label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                      accept=".pdf,.txt,.md,.doc,.docx,.xlsx,.xls,.csv,.pptx,.ppt,.html"
                    />
                  </div>
                  {selectedFile && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">标题（可选）</label>
                          <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                            placeholder="文档标题"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">标签（逗号分隔，可选）</label>
                          <input
                            type="text"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                            placeholder="安全, 文档, 指南"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <><Loader2 className="h-5 w-5 animate-spin" />上传中...</>
                        ) : (
                          <><Upload className="h-5 w-5" />上传文档</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Document List */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    文档列表 ({documents.length})
                  </h2>
                  <button onClick={loadDocuments} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <RefreshCw className="h-4 w-4 text-slate-600" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>暂无文档，请上传文件</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => setSelectedDoc(doc)}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 truncate">{doc.title}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400">{doc.mime_type}</span>
                              <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                              {doc.summary && <span className="text-xs text-purple-500">有摘要</span>}
                            </div>
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex gap-1.5 mt-1.5">
                                {doc.tags.map((tag, i) => (
                                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border', getStatusColor(doc.status))}>
                            {getStatusIcon(doc.status)}
                            {getStatusLabel(doc.status)}
                          </div>
                          <button
                            onClick={(e) => handleDelete(doc.id, e)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'faq' && (
            <motion.div key="faq" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <FAQManager />
            </motion.div>
          )}

          {activeTab === 'tags' && (
            <motion.div key="tags" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <TagManager />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
