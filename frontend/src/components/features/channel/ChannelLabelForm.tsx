import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { useUpdateChannelLabel } from '@/hooks/useChannels';
import { getErrorMessage } from '@/utils/error';

const LABEL_HINT_ID = 'channel-label-hint';

const labelFormSchema = z.object({
  label: z.string().max(100, 'Nhãn tối đa 100 ký tự.'),
});

type LabelFormValues = z.infer<typeof labelFormSchema>;

export const ChannelLabelForm = ({
  workspaceId,
  channelId,
  label,
}: {
  workspaceId: string;
  channelId: string;
  label: string | null;
}) => {
  const updateLabel = useUpdateChannelLabel(workspaceId, channelId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { label: label ?? '' },
  });

  const onSubmit = handleSubmit((values) => {
    const nextLabel = values.label.trim();

    updateLabel.mutate(nextLabel === '' ? null : nextLabel);
  });

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6">
      <div className="space-y-1.5">
        <TextField
          label="Nhãn nội bộ"
          placeholder="Ví dụ: Kênh bán hàng miền Bắc"
          autoComplete="off"
          aria-describedby={LABEL_HINT_ID}
          error={errors.label?.message}
          {...register('label')}
        />
        <p id={LABEL_HINT_ID} className="text-xs text-subtle">
          Dùng để phân biệt các kênh cùng tên. Để trống để dùng tên gốc.
        </p>
      </div>

      {updateLabel.error ? (
        <Alert variant="danger" className="mt-4">
          {getErrorMessage(updateLabel.error)}
        </Alert>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button type="submit" className="min-h-11" isLoading={updateLabel.isPending}>
          Lưu nhãn
        </Button>
      </div>
    </form>
  );
};

export default ChannelLabelForm;
