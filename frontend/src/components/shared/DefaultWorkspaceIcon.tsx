import { cn } from '@/utils/cn';

export const DefaultWorkspaceIcon = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-[#0B57D0]',
      className
    )}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-3/5 w-3/5">
      <rect x="2.5" y="3" width="8" height="18" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 7h2M5.5 10.5h2M5.5 14h2M5.5 17.5h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="12.5" y="7.5" width="9" height="13.5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="15" y="11" width="4" height="2" fill="currentColor" />
      <rect x="15" y="15" width="4" height="2" fill="currentColor" />
    </svg>
  </span>
);

export default DefaultWorkspaceIcon;
