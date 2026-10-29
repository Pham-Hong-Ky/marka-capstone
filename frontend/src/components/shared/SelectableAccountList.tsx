import Avatar from '@/components/ui/Avatar';

export interface SelectableAccount {
  id: string;
  name: string;
  avatar?: string | null;
}

export const SelectableAccountList = ({
  accounts,
  selectedIds,
  onToggle,
  className,
}: {
  accounts: SelectableAccount[];
  selectedIds: string[];
  onToggle: (accountId: string) => void;
  className?: string;
}) => (
  <div className={className}>
    {accounts.map((account) => (
      <label
        key={account.id}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition hover:bg-surface-2"
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-accent"
          checked={selectedIds.includes(account.id)}
          onChange={() => onToggle(account.id)}
        />
        <Avatar name={account.name} src={account.avatar} className="h-9 w-9" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{account.name}</span>
      </label>
    ))}
  </div>
);

export default SelectableAccountList;
