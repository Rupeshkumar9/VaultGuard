import { useState } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function ChangePasswordModal({
  currentPassword,
  newPassword,
  confirmPassword,
  error,
  isSaving,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onClose,
  onSubmit,
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordFields = [
    {
      id: 'change-current-password',
      label: 'Current master password',
      value: currentPassword,
      onChange: onCurrentPasswordChange,
      visible: showCurrentPassword,
      toggle: () => setShowCurrentPassword((visible) => !visible),
      autoComplete: 'current-password',
      placeholder: 'Enter current password',
    },
    {
      id: 'change-new-password',
      label: 'New master password',
      value: newPassword,
      onChange: onNewPasswordChange,
      visible: showNewPassword,
      toggle: () => setShowNewPassword((visible) => !visible),
      autoComplete: 'new-password',
      placeholder: 'At least 8 characters',
    },
    {
      id: 'change-confirm-password',
      label: 'Confirm new master password',
      value: confirmPassword,
      onChange: onConfirmPasswordChange,
      visible: showConfirmPassword,
      toggle: () => setShowConfirmPassword((visible) => !visible),
      autoComplete: 'new-password',
      placeholder: 'Re-enter new password',
    },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md rounded-2xl border border-border-dark bg-surface-dark p-5 shadow-2xl animate-scale-in sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close password change dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3 pr-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-glow text-accent-teal">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 id="change-password-modal-title" className="text-base font-bold text-text-primary">Change Master Password</h2>
            <p className="text-[11px] text-text-secondary">Your vault will be re-encrypted locally before saving.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4 text-left">
          {passwordFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label htmlFor={field.id} className="block text-xs font-semibold text-text-secondary">{field.label}</label>
              <div className="relative">
                <input
                  id={field.id}
                  type={field.visible ? 'text' : 'password'}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  autoComplete={field.autoComplete}
                  required
                  className="w-full rounded-xl border border-border-dark bg-bg-dark px-3 py-2.5 pr-11 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-teal focus:outline-none focus:ring-1 focus:ring-accent-teal/20"
                  placeholder={field.placeholder}
                  disabled={isSaving}
                />
                <button
                  type="button"
                  onClick={field.toggle}
                  disabled={isSaving}
                  aria-label={field.visible ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
                >
                  {field.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/80">
            Keep your new password safe. Without it, your encrypted vault cannot be recovered.
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl border border-border-dark bg-bg-dark px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl bg-accent-teal px-4 py-2.5 text-sm font-bold text-bg-dark transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {isSaving ? <LoadingSpinner size="xs" label="Changing..." /> : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
