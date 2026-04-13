import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, ChevronRight, Loader2, FolderSearch } from 'lucide-react';
import { toast } from 'sonner';
import type { OnboardingPlan, ToolOption } from '../types';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  plan: OnboardingPlan | null;
  tools: ToolOption[];
  syncTargets: Record<string, boolean>;
  onSkillAdded: () => void;
}

function ImportModal({ open, onClose, plan, tools, syncTargets, onSkillAdded }: ImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});

  // Initialize default selections when plan changes
  useEffect(() => {
    if (plan) {
      const defaultSelected: Record<string, boolean> = {};
      const defaultChoice: Record<string, string> = {};
      plan.groups.forEach((group) => {
        defaultSelected[group.name] = true;
        const first = group.variants[0];
        if (first) {
          defaultChoice[group.name] = first.path;
        }
      });
      setSelected(defaultSelected);
      setVariantChoice(defaultChoice);
    }
  }, [plan]);

  const handleToggleGroup = useCallback((groupName: string, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [groupName]: checked
    }));
  }, []);

  const handleSelectVariant = useCallback((groupName: string, path: string) => {
    setVariantChoice((prev) => ({
      ...prev,
      [groupName]: path
    }));
  }, []);

  const handleImport = useCallback(async () => {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      let importedCount = 0;
      for (const group of plan.groups) {
        if (!selected[group.name]) continue;
        const chosenPath = variantChoice[group.name] ?? group.variants[0]?.path;
        if (!chosenPath) continue;

        // Import the skill
        const installResult = await invoke<{
          id: string;
          name: string;
          central_path: string;
        }>('import_existing_skill', {
          source_path: chosenPath,
          name: group.name
        });

        // Sync to selected tools
        const selectedTools = tools.filter(tool => syncTargets[tool.id]);
        for (const tool of selectedTools) {
          await invoke('sync_skill_to_tool', {
            skillId: installResult.id,
            skillName: installResult.name,
            tool: tool.id,
            sourcePath: installResult.central_path,
          });
        }
        importedCount++;
      }

      if (importedCount > 0) {
        toast.success(`成功导入 ${importedCount} 个技能`);
      }
      onClose();
      onSkillAdded();
    } catch (err) {
      console.error('[DEBUG] import error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [plan, selected, variantChoice, tools, syncTargets, onClose, onSkillAdded]);

  if (!open || !plan) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl border border-[hsl(var(--border))] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-[hsl(var(--border))] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate">导入现有技能</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              从已安装的工具中发现 {plan.total_skills_found} 个技能
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

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 min-h-0">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {plan.groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
                <FolderSearch size={28} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <h3 className="text-base font-medium mb-1">未发现现有技能</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                在已安装的工具目录中未找到技能文件
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {plan.groups.map((group) => (
                <div key={group.name} className="rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]">
                  {/* 技能组头部 */}
                  <div className="px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-[hsl(var(--muted)/30)] transition-colors">
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected[group.name] || false}
                        onChange={(e) => handleToggleGroup(group.name, e.target.checked)}
                        className="w-4 h-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                        disabled={loading}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm truncate">{group.name}</h4>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {group.variants.length} 个来源
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* 技能组变体 */}
                  {selected[group.name] && (
                    <div className="px-3 sm:px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/50)] space-y-2">
                      {group.variants.map((variant) => (
                        <label key={variant.path} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name={`variant-${group.name}`}
                            checked={variantChoice[group.name] === variant.path}
                            onChange={() => handleSelectVariant(group.name, variant.path)}
                            className="w-4 h-4 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                            disabled={loading}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{variant.tool}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{variant.path}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/30] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] active:brightness-[0.9] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))]"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !Object.values(selected).some(Boolean)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--primary))] hover:brightness-[0.9] active:brightness-[0.85] text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                导入选中的技能
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
