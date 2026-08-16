import { RefreshCw } from 'lucide-react';

const SIZE_CLASSES = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export default function LoadingSpinner({ size = 'md', label, className = '' }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={`inline-flex items-center ${label ? 'gap-2' : ''} ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <RefreshCw className={`${sizeClass} animate-spin`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
