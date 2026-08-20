import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

/**
 * Confirmation dialog for destructive or significant actions (delete product,
 * cancel order). Built on Modal. `tone` colors the confirm button; `loading`
 * disables both actions and shows a spinner.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'brand',
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'brand' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmClass =
    tone === 'danger'
      ? 'bg-coral text-white hover:brightness-105 shadow-coral/25'
      : 'brand-gradient text-white shadow-brand-600/25';

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full bg-white/60 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white/80 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 ${confirmClass}`}
          >
            {loading && <Spinner size={15} tone="light" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-soft">{message}</div>
    </Modal>
  );
}
