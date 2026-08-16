import { useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Trash2, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const ACTION_COPY = {
  delete: {
    title: 'Move to Trash?',
    message: 'Are you sure you want to move this credential to the trash? You can restore it later.',
    confirmLabel: 'Move to Trash',
    icon: Trash2,
    confirmClassName: 'bg-rose-600 hover:bg-rose-700 border-rose-700 text-white',
  },
  permanentDelete: {
    title: 'Delete Permanently?',
    message: 'Are you sure you want to permanently delete this credential? This action cannot be undone.',
    confirmLabel: 'Delete Permanently',
    icon: Trash2,
    confirmClassName: 'bg-rose-600 hover:bg-rose-700 border-rose-700 text-white',
  },
  restore: {
    title: 'Restore Credential?',
    message: 'Are you sure you want to restore this credential from the trash?',
    confirmLabel: 'Restore Credential',
    icon: RefreshCw,
    confirmClassName: 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white',
  },
};

export default function ConfirmationModal({
  action,
  itemCount = 1,
  isProcessing = false,
  onCancel,
  onConfirm,
}) {
  const cancelButtonRef = useRef(null);
  const copy = ACTION_COPY[action] || ACTION_COPY.delete;
  const Icon = copy.icon;
  const isBulk = itemCount > 1;
  const countLabel = isBulk ? `these ${itemCount} credentials` : 'this credential';
  const message = isBulk
    ? copy.message.replace('this credential', countLabel)
    : copy.message;

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isProcessing) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isProcessing) onCancel();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border-dark bg-surface-dark p-5 sm:p-6 shadow-2xl animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          aria-label="Close confirmation dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action === 'restore' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 id="confirmation-modal-title" className="text-base font-bold text-text-primary">
              {copy.title}
            </h2>
            <p id="confirmation-modal-message" className="mt-2 text-sm leading-6 text-text-secondary">
              {message}
            </p>
            {action !== 'restore' && (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-amber-300/80">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {action === 'permanentDelete' ? 'Permanently deleted credentials cannot be recovered.' : 'The credential will be moved out of your active vault.'}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="min-h-11 flex-1 rounded-xl border border-border-dark bg-bg-dark px-4 py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`min-h-11 flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${copy.confirmClassName}`}
          >
            {isProcessing ? (
              <LoadingSpinner size="sm" label="Processing..." />
            ) : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
