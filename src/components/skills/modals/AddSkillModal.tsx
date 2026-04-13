import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as dialog from '@tauri-apps/plugin-dialog';
import { GitBranch, Folder, X, ChevronRight, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { ToolOption } from '../types';

// 工具颜色映射，与 MCP 面板保持一致
const appColors: Record<string, string> = {
  "qwen-code": "bg-purple-500",
  claude: "bg-orange-500",
  codex: "bg-blue-500",
  gemini: "bg-green-500",
  opencode: "bg-cyan-500",
  openclaw: "bg-pink-500",
  trae: "bg-indigo-500",
  "trae-cn": "bg-violet-500",
  "trae-solo-cn": "bg-fuchsia-500",
  qoder: "bg-yellow-500",
  codebuddy: "bg-red-500",
};

interface AddSkillModalProps {
  open: boolean;
  onClose: () => void;
  tools: ToolOption[];
  syncTargets: Record<string, boolean>;
  onSyncTargetChange: (toolId: string, checked: boolean) => void;
  onSkillAdded: () => void;
}

type Tab = 'git' | 'local';

function AddSkillModal({ open, onClose, tools, syncTargets, onSyncTargetChange, onSkillAdded }: AddSkillModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('git');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [gitName, setGitName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [localName, setLocalName] = useState('');

  const handlePickLocalPath = useCallback(async () => {
    try {
      const selected = await dialog.open({
        directory: true,
        multiple: false,
        title: '选择本地文件夹'
      });
      if (!selected || Array.isArray(selected)) return;
      setLocalPath(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleCreateGit = useCallback(async () => {
    if (!gitUrl.trim()) {
      setError('请输入Git仓库URL');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('[DEBUG] Invoking install_git with:', { repoUrl: gitUrl.trim(), name: gitName.trim() || undefined });
      const created = await invoke<{
        id: string;
        name: string;
        central_path: string;
      }>('install_git', {
        repoUrl: gitUrl.trim(),
        name: gitName.trim() || undefined
      });
      console.log('[DEBUG] install_git returned:', created);

      // Sync to selected tools
      const selectedTools = tools.filter(tool => syncTargets[tool.id]);
      console.log('[DEBUG] Selected tools to sync:', selectedTools.map(t => t.id));
      console.log('[DEBUG] syncTargets state:', syncTargets);
      for (const tool of selectedTools) {
        console.log('[DEBUG] Syncing to tool:', tool.id, 'with skillId:', created.id, 'skillName:', created.name, 'sourcePath:', created.central_path);
        await invoke('sync_skill_to_tool', {
          skillId: created.id,
          skillName: created.name,
          tool: tool.id,
          sourcePath: created.central_path,
        });
        console.log('[DEBUG] Sync to', tool.id, 'completed');
      }
      console.log('[DEBUG] All syncs completed');

      setGitUrl('');
      setGitName('');
      toast.success(`技能 "${created.name}" 添加成功`);
      onClose();
      onSkillAdded();
    } catch (err) {
      console.error('[DEBUG] install_git error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gitUrl, gitName, tools, syncTargets, onClose, onSkillAdded]);

  const handleCreateLocal = useCallback(async () => {
    if (!localPath.trim()) {
      setError('请选择本地文件夹');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('[DEBUG] Invoking install_local_selection with:', { basePath: localPath.trim(), subpath: '', name: localName.trim() || undefined });
      const created = await invoke<{
        id: string;
        name: string;
        central_path: string;
      }>('install_local_selection', {
        basePath: localPath.trim(),
        subpath: '',
        name: localName.trim() || undefined
      });
      console.log('[DEBUG] install_local_selection returned:', created);

      // Sync to selected tools
      const selectedTools = tools.filter(tool => syncTargets[tool.id]);
      console.log('[DEBUG] Selected tools to sync:', selectedTools.map(t => t.id));
      console.log('[DEBUG] syncTargets state:', syncTargets);
      for (const tool of selectedTools) {
        console.log('[DEBUG] Syncing to tool:', tool.id, 'with skillId:', created.id, 'skillName:', created.name, 'sourcePath:', created.central_path);
        await invoke('sync_skill_to_tool', {
          skillId: created.id,
          skillName: created.name,
          tool: tool.id,
          sourcePath: created.central_path,
        });
        console.log('[DEBUG] Sync to', tool.id, 'completed');
      }
      console.log('[DEBUG] All syncs completed');

      setLocalPath('');
      setLocalName('');
      toast.success(`技能 "${created.name}" 添加成功`);
      onClose();
      onSkillAdded();
    } catch (err) {
      console.error('[DEBUG] install_local_selection error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [localPath, localName, tools, syncTargets, onClose, onSkillAdded]);

  const toggleTool = (toolId: string) => {
    onSyncTargetChange(toolId, !syncTargets[toolId]);
  };

  const toggleAllTools = () => {
    const allEnabled = tools.every(t => syncTargets[t.id]);
    tools.forEach(t => onSyncTargetChange(t.id, !allEnabled));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl border border-[hsl(var(--border))] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-[hsl(var(--border))] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate">添加技能</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              从 Git 仓库或本地文件夹添加
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors flex-shrink-0"
            disabled={loading}
          >
            <X size={18} className="text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5 min-h-0">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* 标签页 */}
          <div className="flex rounded-lg bg-[hsl(var(--muted))] p-1">
            <button
              onClick={() => setActiveTab('git')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'git'
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <GitBranch size={14} />
              <span>Git 仓库</span>
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'local'
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Folder size={14} />
              <span>本地文件夹</span>
            </button>
          </div>

          {activeTab === 'git' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  Git 仓库 URL
                </label>
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="例如: https://github.com/username/repo.git"
                  className="w-full px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  技能名称 <span className="text-[hsl(var(--muted-foreground))] font-normal">(可选)</span>
                </label>
                <input
                  type="text"
                  value={gitName}
                  onChange={(e) => setGitName(e.target.value)}
                  placeholder="留空则使用仓库名称"
                  className="w-full px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {activeTab === 'local' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  本地文件夹
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    placeholder="选择或输入文件夹路径"
                    className="flex-1 px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                    disabled={loading}
                  />
                  <button
                    onClick={handlePickLocalPath}
                    className="px-4 py-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-sm font-medium transition-all whitespace-nowrap"
                    disabled={loading}
                  >
                    浏览
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  技能名称 <span className="text-[hsl(var(--muted-foreground))] font-normal">(可选)</span>
                </label>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="留空则使用文件夹名称"
                  className="w-full px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* 同步目标 */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] p-3 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">同步到工具</label>
              {tools.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllTools}
                  className="text-xs text-[hsl(var(--primary))] hover:underline flex-shrink-0"
                >
                  {tools.every(t => syncTargets[t.id]) ? '取消全选' : '全选'}
                </button>
              )}
            </div>
            {tools.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tools.map(tool => {
                  const enabled = syncTargets[tool.id] ?? false;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        enabled
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))]"
                      }`}
                      disabled={loading}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          enabled
                            ? appColors[tool.id] || "bg-[hsl(var(--foreground))]"
                            : "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
                        }`}
                      >
                        {enabled && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm">{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                未检测到已安装的 AI 工具。
              </p>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] active:brightness-[0.9] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))]"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={activeTab === 'git' ? handleCreateGit : handleCreateLocal}
            disabled={loading}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--primary))] hover:brightness-[0.9] active:brightness-[0.85] text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                添加技能
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddSkillModal;
