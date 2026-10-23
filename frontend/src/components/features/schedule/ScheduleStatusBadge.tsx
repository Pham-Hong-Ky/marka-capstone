import {
  SCHEDULE_STATUS_BADGE_CLASSES,
  SCHEDULE_STATUS_LABELS,
  type ScheduleStatus,
} from '@/services/schedule';
import { cn } from '@/utils/cn';

export const ScheduleStatusBadge = ({ status }: { status: ScheduleStatus }) => (
  <span
    className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      SCHEDULE_STATUS_BADGE_CLASSES[status]
    )}
  >
    {SCHEDULE_STATUS_LABELS[status]}
  </span>
);

export default ScheduleStatusBadge;
