import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Upload, ToggleLeft, ToggleRight, HelpCircle, Save, X, Loader2, Search } from 'lucide-react';
import { kbAPI } from '../services/api';
import type { FAQEntry } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

interface FAQManagerProps {
  /** 当在知识库详情内使用时，只显示该知识库下的 FAQ，新建时也会归属到该知识库 */
  knowledgeBaseId?: string;
  /** 列表变更后回调（如刷新父级统计） */
  onListChange?: () => void;
}

export default function FAQManager({ knowledgeBaseId, onListChange }: FAQManagerProps = {}) {
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [similarQuestions, setSimilarQuestions] = useState('');
  const [faqTags, setFaqTags] = useState('');

  const loadFAQs = async () => {
    try {
      const data = await kbAPI.listFAQ(0, 100, knowledgeBaseId);
      setFaqs(data);
      onListChange?.();
    } catch (e) {
      console.error('Failed to load FAQs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFAQs(); }, [knowledgeBaseId]);

  const resetForm = () => {
    setQuestion('');
    setAnswer('');
    setSimilarQuestions('');
    setFaqTags('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) return;
    const payload = {
      question: question.trim(),
      answer: answer.trim(),
      similar_questions: similarQuestions ? similarQuestions.split('\n').map(s => s.trim()).filter(Boolean) : [],
      tags: faqTags ? faqTags.split(',').map(s => s.trim()).filter(Boolean) : [],
      ...(knowledgeBaseId && !editingId ? { knowledge_base_id: knowledgeBaseId } : {}),
    };

    try {
      if (editingId) {
        await kbAPI.updateFAQ(editingId, payload);
      } else {
        await kbAPI.createFAQ(payload);
      }
      resetForm();
      await loadFAQs();
    } catch (e) {
      console.error('Save FAQ failed:', e);
      alert('保存失败，请重试');
    }
  };

  const handleEdit = (faq: FAQEntry) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setSimilarQuestions(faq.similar_questions?.join('\n') || '');
    setFaqTags(faq.tags?.join(', ') || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条 FAQ 吗？')) return;
    try {
      await kbAPI.deleteFAQ(id);
      await loadFAQs();
    } catch (e) {
      console.error('Delete FAQ failed:', e);
    }
  };

  const handleToggle = async (faq: FAQEntry) => {
    try {
      await kbAPI.updateFAQ(faq.id, { is_enabled: !faq.is_enabled });
      await loadFAQs();
    } catch (e) {
      console.error('Toggle FAQ failed:', e);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await kbAPI.importFAQCSV(file, knowledgeBaseId);
      alert(`成功导入 ${result.imported} 条 FAQ`);
      await loadFAQs();
    } catch (err) {
      console.error('CSV import failed:', err);
      alert('CSV 导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const filtered = faqs.filter(f =>
    !searchQuery || f.question.toLowerCase().includes(searchQuery.toLowerCase()) || f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索 FAQ..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors shadow-sm",
            importing && "opacity-50 pointer-events-none"
          )}>
            <Upload className="h-4 w-4 text-slate-600" />
            {importing ? '导入中...' : 'CSV 导入'}
            <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
          </label>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            新建 FAQ
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">{editingId ? '编辑 FAQ' : '新建 FAQ'}</h3>
                <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">问题 *</label>
                  <input
                    type="text"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                    placeholder="例如：如何重置密码？"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">答案 *</label>
                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm resize-none"
                    placeholder="详细的回答内容..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">相似问题（每行一个，可选）</label>
                  <textarea
                    value={similarQuestions}
                    onChange={e => setSimilarQuestions(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm resize-none"
                    placeholder="密码忘了怎么办？&#10;怎样修改密码？"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">标签（逗号分隔，可选）</label>
                  <input
                    type="text"
                    value={faqTags}
                    onChange={e => setFaqTags(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm"
                    placeholder="安全, 账户"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={resetForm} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!question.trim() || !answer.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {editingId ? '保存修改' : '创建'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAQ List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">{searchQuery ? '没有匹配的 FAQ' : '暂无 FAQ，点击"新建 FAQ"添加'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq, index) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "bg-white rounded-xl border p-5 transition-all hover:shadow-md",
                faq.is_enabled ? "border-slate-200" : "border-orange-200 bg-orange-50/30"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Q</span>
                    <h4 className="font-semibold text-slate-900 truncate">{faq.question}</h4>
                    {!faq.is_enabled && (
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">已禁用</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-0.5">A</span>
                    <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{faq.answer}</p>
                  </div>
                  {faq.tags && faq.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {faq.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(faq)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title={faq.is_enabled ? '禁用' : '启用'}
                  >
                    {faq.is_enabled
                      ? <ToggleRight className="h-5 w-5 text-green-500" />
                      : <ToggleLeft className="h-5 w-5 text-slate-400" />
                    }
                  </button>
                  <button
                    onClick={() => handleEdit(faq)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
