import { User, X } from 'lucide-react';

export default function ProfileEditModal({
  name,
  email,
  currentPassword,
  error,
  isSaving,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="relative w-full max-w-md rounded-2xl border border-border-dark bg-surface-dark p-5 shadow-2xl animate-scale-in sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close profile editor"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-border-dark/50 pb-3 pr-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-glow text-accent-teal">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 id="profile-modal-title" className="text-base font-bold text-text-primary">Edit Profile</h2>
            <p className="text-[11px] text-text-secondary">Update your display name or login email.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4 text-left">
          <div className="space-y-1.5">
            <label htmlFor="profile-name" className="block text-xs font-semibold text-text-secondary">Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-border-dark bg-bg-dark px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-teal focus:outline-none focus:ring-1 focus:ring-accent-teal/20"
              placeholder="Your name"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-email" className="block text-xs font-semibold text-text-secondary">Email address</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              className="w-full rounded-xl border border-border-dark bg-bg-dark px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-teal focus:outline-none focus:ring-1 focus:ring-accent-teal/20"
              disabled={isSaving}
            />
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/80">
            Changing the email requires your current password and re-encrypts the vault locally before saving.
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-current-password" className="block text-xs font-semibold text-text-secondary">
              Current password <span className="font-normal text-text-secondary/60">(required only for email changes)</span>
            </label>
            <input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-border-dark bg-bg-dark px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-teal focus:outline-none focus:ring-1 focus:ring-accent-teal/20"
              placeholder="Enter current password"
              disabled={isSaving}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl border border-border-dark bg-bg-dark px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl bg-accent-teal px-4 py-2.5 text-sm font-bold text-bg-dark transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
