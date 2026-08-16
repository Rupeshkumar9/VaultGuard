import LoadingSpinner from './LoadingSpinner';

export default function ProcessingOverlay({ title, description }) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-surface-dark/85 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent-teal/20 bg-bg-dark/80 px-6 py-5 text-center shadow-2xl">
        <LoadingSpinner size="lg" className="text-accent-teal" />
        <div>
          <p className="text-sm font-bold text-text-primary">{title}</p>
          <p className="mt-1 text-xs text-text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}
