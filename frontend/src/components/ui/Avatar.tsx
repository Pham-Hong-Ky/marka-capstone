import { cn } from '@/utils/cn';

export const Avatar = ({
  name,
  src,
  className,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  const initial = name?.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-foreground',
        className
      )}
    >
      {initial}
    </span>
  );
};

export default Avatar;
