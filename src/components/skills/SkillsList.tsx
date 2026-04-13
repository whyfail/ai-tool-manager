import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GitBranch, Folder, RotateCw, Trash2, Sparkles, X, ExternalLink, FileText } from 'lucide-react';
import type { ManagedSkill, ToolOption } from './types';

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

interface SkillsListProps {
  skills: ManagedSkill[];
  tools: ToolOption[];
  syncTargets: Record<string, boolean>;
  onSyncTargetChange: (toolId: string, checked: boolean) => void;
  searchQuery: string;
  onUpdateSkill: (skill: ManagedSkill) => void;
  onDeleteSkill: (skill: ManagedSkill) => void;
  onDeleteId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function SkillsList({
  skills,
  tools,
  syncTargets,
  onSyncTargetChange,
  searchQuery,
  onUpdateSkill,
  onDeleteSkill,
  onDeleteId,
  onConfirmDelete,
  onCancelDelete,
}: SkillsListProps) {
  const [detailSkill, setDetailSkill] = useState<ManagedSkill | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const filteredSkills = skills.filter(skill => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.central_path.toLowerCase().includes(query) ||
      skill.source_type.toLowerCase().includes(query)
    );
  });

  const deleteSkill = onDeleteId ? skills.find(s => s.id === onDeleteId) : null;

  const sourceTypeLabel = (type: string) => {
    switch (type) {
      case 'git': return 'Git';
      case 'link': return '软链接';
      case 'local': return '本地';
      default: return type;
    }
  };

  const handleOpenDetail = async (skill: ManagedSkill) => {
    setDetailSkill(skill);
    setReadmeContent(null);
    setReadmeLoading(true);
    try {
      const content = await invoke<string>('get_skill_readme', { skillName: skill.name });
      setReadmeContent(content);
    } catch (err) {
      console.error('Failed to load SKILL.md:', err);
      setReadmeContent(null);
    } finally {
      setReadmeLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
              <Sparkles
                size={28}
                className="text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <h3 className="text-base font-medium mb-1">
              {searchQuery ? '未找到匹配的技能' : '暂无技能'}
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {searchQuery ? '尝试其他关键词搜索' : '点击"添加技能"开始管理你的技能'}
            </p>
          </div>
        ) : (
          filteredSkills.map(skill => (
            <div
              key={skill.id}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))] transition-all duration-150 overflow-hidden"
            >
              {/* 技能头部 */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0">
                    {skill.source_type === 'git' ? (
                      <GitBranch size={16} className="text-white" />
                    ) : (
                      <Folder size={16} className="text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => handleOpenDetail(skill)}
                      className="text-sm font-semibold truncate hover:text-[hsl(var(--primary))] transition-colors text-left"
                    >
                      {skill.name}
                    </button>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {sourceTypeLabel(skill.source_type)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onUpdateSkill(skill)}
                    className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                    title="更新技能"
                  >
                    <RotateCw size={14} className="text-[hsl(var(--muted-foreground))]" />
                  </button>
                  <button
                    onClick={() => onDeleteSkill(skill)}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="删除技能"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>

              {/* 同步目标（始终显示） */}
              <div className="px-3 sm:px-5 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/50)]">
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {tools.map(tool => (
                    <label
                      key={tool.id}
                      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg cursor-pointer transition-all text-xs font-medium ${
                        syncTargets[tool.id]
                          ? "bg-[hsl(var(--primary))/10] text-[hsl(var(--primary))]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={syncTargets[tool.id] || false}
                        onChange={(e) => onSyncTargetChange(tool.id, e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          syncTargets[tool.id]
                            ? appColors[tool.id] || "bg-[hsl(var(--foreground))]"
                            : "bg-current opacity-40"
                        }`}
                      />
                      <span>{tool.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 详情弹窗 */}
      {detailSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl border border-[hsl(var(--border))] flex flex-col overflow-hidden max-h-[90vh]">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                  {detailSkill.source_type === 'git' ? (
                    <GitBranch size={20} className="text-white" />
                  ) : (
                    <Folder size={20} className="text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{detailSkill.name}</h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {sourceTypeLabel(detailSkill.source_type)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailSkill(null)}
                className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
              >
                <X size={18} className="text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
              {readmeLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-[hsl(var(--muted-foreground))]">加载中...</div>
                </div>
              ) : readmeContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-sm [&_ul]:text-sm [&_ol]:text-sm [&_li]:text-sm [&_code]:bg-[hsl(var(--muted))] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:break-all [&_pre]:bg-[hsl(var(--muted))] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-[hsl(var(--primary))] [&_a]:underline [&_table]:text-sm [&_th]:bg-[hsl(var(--muted))] [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_tr]:border [&_table]:block [&_table]:overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <FileText size={32} className="text-[hsl(var(--muted-foreground))] mb-2" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    技能目录下没有 SKILL.md 文件
                  </p>
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/30] flex-shrink-0 flex justify-end gap-3">
              <button
                onClick={() => {
                  onUpdateSkill(detailSkill);
                  setDetailSkill(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-[hsl(var(--secondary-foreground))] transition-all border border-[hsl(var(--border))]"
              >
                更新
              </button>
              <button
                onClick={() => {
                  setDetailSkill(null);
                  onDeleteSkill(detailSkill);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {onDeleteId && deleteSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-[hsl(var(--card))] rounded-xl w-full max-w-sm shadow-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="px-6 py-5 border-b border-[hsl(var(--border))]">
              <h3 className="text-lg font-semibold">确认删除？</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 line-clamp-1">
                技能: {deleteSkill.name}
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                onClick={onCancelDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-[hsl(var(--secondary-foreground))]"
              >
                取消
              </button>
              <button
                onClick={onConfirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SkillsList;
