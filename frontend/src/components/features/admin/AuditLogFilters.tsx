import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import { AUDIT_ACTION_LABELS, AUDIT_TARGET_TYPES } from '@/services/admin';

interface AuditLogFiltersProps {
  action: string;
  targetType: string;
  dateFrom: string;
  dateTo: string;
  hasFilters: boolean;
  onActionChange: (value: string) => void;
  onTargetTypeChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

export const AuditLogFilters = ({
  action,
  targetType,
  dateFrom,
  dateTo,
  hasFilters,
  onActionChange,
  onTargetTypeChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: AuditLogFiltersProps) => (
  <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField
        label="Hành động"
        name="action"
        className="min-h-11"
        value={action}
        onChange={(event) => onActionChange(event.target.value)}
      >
        <option value="">Tất cả</option>
        {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Đối tượng"
        name="targetType"
        className="min-h-11"
        value={targetType}
        onChange={(event) => onTargetTypeChange(event.target.value)}
      >
        <option value="">Tất cả</option>
        {AUDIT_TARGET_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Từ ngày"
        name="dateFrom"
        type="date"
        className="min-h-11"
        value={dateFrom}
        onChange={(event) => onDateFromChange(event.target.value)}
      />
      <TextField
        label="Đến ngày"
        name="dateTo"
        type="date"
        className="min-h-11"
        value={dateTo}
        onChange={(event) => onDateToChange(event.target.value)}
      />
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={!hasFilters}
        onClick={onClear}
      >
        Xoá lọc
      </Button>
    </div>
  </div>
);

export default AuditLogFilters;
