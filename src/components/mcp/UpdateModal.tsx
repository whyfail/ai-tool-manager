import React from "react";
import { X, ArrowUpCircle, Loader2 } from "lucide-react";

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
  version: string;
  body: string;
  onInstall: () => void;
  installing: boolean;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  onClose,
  version,
  body,
  onInstall,
  installing,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpCircle size={20} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">
                发现新版本
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                v{version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <X size={16} className="text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* 更新内容 */}
        <div className="px-6 pb-4">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
            <h4 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
              更新日志
            </h4>
            <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {body || "暂无更新说明"}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
          >
            {installing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUpCircle size={16} />
            )}
            {installing ? "下载更新中..." : "下载并安装"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
          >
            稍后
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
