import { GitBranch, X, Loader2, Check } from 'lucide-react';

export interface GitSkillCandidate {
  name: string;
  description: string | null;
  subpath: string;
}

interface GitPickModalProps {
  open: boolean;
  candidates: GitSkillCandidate[];
  selected: GitSkillCandidate[];
  loading: boolean;
  onToggle: (candidate: GitSkillCandidate) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function GitPickModal({ open, candidates, selected, loading, onToggle, onConfirm, onCancel }: GitPickModalProps) {
  if (!open) return null;

  const isSelected = (c: GitSkillCandidate) =>
    selected.some((s) => s.subpath === c.subpath);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-modal flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-white/50 px-4 py-4 dark:border-white/10 sm:px-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">选择技能</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              已选择 {selected.length} 个技能
            </p>
          </div>
          <button
            onClick={onCancel}
            className="glass-icon-button"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">正在扫描仓库...</span>
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-2">
              {candidates.map((candidate, index) => {
                const checked = isSelected(candidate);
                return (
                  <button
                    key={index}
                    onClick={() => onToggle(candidate)}
                    className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                      checked
                        ? "border-blue-200/70 bg-blue-500/10 dark:border-sky-300/20"
                        : "border-white/55 bg-white/50 hover:bg-white/75 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checked
                          ? "border-blue-600 bg-blue-600"
                          : "border-white/60 bg-white/60 dark:border-white/10 dark:bg-white/8"
                      }`}
                    >
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500">
                      <GitBranch size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{candidate.name}</div>
                      {candidate.description && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                          {candidate.description}
                        </div>
                      )}
                      <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {candidate.subpath}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              未在仓库中找到有效的技能
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex gap-3 border-t border-white/50 bg-white/25 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
          <button
            onClick={onCancel}
            className="glass-secondary-button flex-1"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={selected.length === 0}
            className="glass-primary-button flex-1"
          >
            确认选择 {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GitPickModal;
