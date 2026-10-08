import { cn } from '@/utils/cn';

export const BrandLogo = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600',
      className
    )}
  >
    <svg viewBox="0 0 64 64" fill="none" className="h-3/5 w-3/5 text-white" aria-hidden="true">
      <path
        d="M20 45V19l12 15 12-15v26"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export default BrandLogo;
