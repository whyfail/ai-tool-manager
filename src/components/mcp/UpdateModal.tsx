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
        className="glass-modal mx-4 w-full max-w-md overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <ArrowUpCircle size={20} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">
                发现新版本
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                v{version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass-icon-button"
          >
            <X size={16} />
          </button>
        </div>

        {/* 更新内容 */}
        <div className="px-6 pb-4">
          <div className="glass-code rounded-xl p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              更新日志
            </h4>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {body || "暂无更新说明"}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onInstall}
            disabled={installing}
            className="glass-primary-button flex-1"
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
            className="glass-secondary-button"
          >
            稍后
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
