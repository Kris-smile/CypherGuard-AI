import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag as TagIcon, Loader2, Palette } from 'lucide-react';
import { kbAPI } from '../services/api';
import type { Tag } from '../services/api';
import { motion } from 'framer-motion';
import { cn } from '../utils';

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#14B8A6', '#06B6D4', '#6B7280',
];

export default function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadTags(); }, []);

  const loadTags = async () => {
    try {
      const data = await kbAPI.listTags();
      setTags(data);
    } catch (e) {
      console.error('Failed to load tags:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await kbAPI.createTag(newName.trim(), newColor);
      setNewName('');
      setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      await loadTags();
    } catch (e) {
      console.error('Create tag failed:', e);
      alert('创建标签失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个标签吗？')) return;
    try {
      await kbAPI.deleteTag(id);
      await loadTags();
    } catch (e) {
      console.error('Delete tag failed:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Tag */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-blue-600" />
          创建标签
        </h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">标签名称</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="例如：漏洞分析、威胁情报..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <Palette className="h-3.5 w-3.5" />
              颜色
            </label>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    newColor === color ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            创建
          </button>
        </div>
      </div>

      {/* Tag List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-16">
          <TagIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">暂无标签，创建一个开始吧</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">全部标签 ({tags.length})</h3>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag, index) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all"
              >
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#6B7280' }} />
                <span className="text-sm font-medium text-slate-700">{tag.name}</span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
