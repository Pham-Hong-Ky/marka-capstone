import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import TextArea from '@/components/ui/TextArea';
import TextField from '@/components/ui/TextField';
import { useUpdateBrandVoice } from '@/hooks/useBrandVoice';
import {
  MAX_FEW_SHOT_EXAMPLES,
  brandVoiceFormSchema,
  formatKeywords,
  parseKeywords,
  type BrandVoice,
  type BrandVoiceFormValues,
} from '@/services/brandvoice';

const toFormValues = (brandVoice: BrandVoice | null): BrandVoiceFormValues => ({
  industry: brandVoice?.industry ?? '',
  targetAudience: brandVoice?.targetAudience ?? '',
  writingStyle: brandVoice?.writingStyle ?? '',
  keywordsShouldUse: formatKeywords(brandVoice?.keywordsShouldUse ?? []),
  keywordsAvoid: formatKeywords(brandVoice?.keywordsAvoid ?? []),
  fewShotExamples: (brandVoice?.fewShotExamples ?? []).map((example) => ({
    title: example.title ?? '',
    content: example.content,
  })),
});

const toPayload = (values: BrandVoiceFormValues): BrandVoice => ({
  industry: values.industry,
  targetAudience: values.targetAudience,
  writingStyle: values.writingStyle,
  keywordsShouldUse: parseKeywords(values.keywordsShouldUse),
  keywordsAvoid: parseKeywords(values.keywordsAvoid),
  fewShotExamples: values.fewShotExamples.map((example) => ({
    ...(example.title ? { title: example.title } : {}),
    content: example.content,
  })),
});

export const BrandVoiceForm = ({
  workspaceId,
  brandVoice,
  canEdit,
}: {
  workspaceId: string;
  brandVoice: BrandVoice | null;
  canEdit: boolean;
}) => {
  const updateBrandVoice = useUpdateBrandVoice();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandVoiceFormValues>({
    resolver: zodResolver(brandVoiceFormSchema),
    defaultValues: toFormValues(brandVoice),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'fewShotExamples' });

  const onSubmit = (values: BrandVoiceFormValues) =>
    updateBrandVoice.mutate({ workspaceId, payload: toPayload(values) });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-2xl border border-border bg-surface p-6"
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Thông tin thương hiệu</h2>
            <p className="mt-0.5 text-sm text-muted">
              Ngữ cảnh để AI viết đúng giọng của workspace.
            </p>
          </div>

          <TextField
            label="Ngành hàng"
            placeholder="Ví dụ: Thời trang nữ"
            error={errors.industry?.message}
            {...register('industry')}
          />

          <TextArea
            label="Đối tượng mục tiêu"
            rows={3}
            placeholder="Ví dụ: Nữ 22-30 tuổi tại Hà Nội, quan tâm phong cách tối giản"
            error={errors.targetAudience?.message}
            {...register('targetAudience')}
          />

          <TextArea
            label="Phong cách viết"
            rows={3}
            placeholder="Ví dụ: thân thiện, gần gũi, hạn chế thuật ngữ chuyên ngành"
            error={errors.writingStyle?.message}
            {...register('writingStyle')}
          />
        </div>

        <div className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Từ khoá</h2>
            <p className="mt-0.5 text-sm text-muted">
              Phân tách các từ khoá bằng dấu phẩy, tối đa 30 từ khoá mỗi nhóm.
            </p>
          </div>

          <TextArea
            label="Từ khoá nên dùng"
            rows={2}
            placeholder="thanh lịch, tối giản"
            error={errors.keywordsShouldUse?.message}
            {...register('keywordsShouldUse')}
          />

          <TextArea
            label="Từ khoá cần tránh"
            rows={2}
            placeholder="hàng chợ, giá rẻ"
            error={errors.keywordsAvoid?.message}
            {...register('keywordsAvoid')}
          />
        </div>

        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Bài viết mẫu</h2>
              <p className="mt-0.5 text-sm text-muted">
                Tối đa {MAX_FEW_SHOT_EXAMPLES} bài tiêu biểu để AI bắt chước giọng điệu.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= MAX_FEW_SHOT_EXAMPLES}
              onClick={() => append({ title: '', content: '' })}
            >
              <Plus className="h-4 w-4" />
              Thêm bài mẫu
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
              Chưa có bài viết mẫu nào.
            </p>
          ) : null}

          {fields.map((field, index) => (
            <div key={field.id} className="space-y-4 rounded-xl bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Bài mẫu {index + 1}</span>

                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Xoá bài mẫu ${index + 1}`}
                  onClick={() => remove(index)}
                  className="h-11 w-11 px-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <TextField
                label="Tiêu đề (không bắt buộc)"
                error={errors.fewShotExamples?.[index]?.title?.message}
                {...register(`fewShotExamples.${index}.title`)}
              />

              <TextArea
                label="Nội dung"
                rows={4}
                error={errors.fewShotExamples?.[index]?.content?.message}
                {...register(`fewShotExamples.${index}.content`)}
              />
            </div>
          ))}

          {errors.fewShotExamples?.root?.message ? (
            <p className="text-xs text-red-400">{errors.fewShotExamples.root.message}</p>
          ) : null}
        </div>
      </fieldset>

      {canEdit ? (
        <div className="flex justify-end border-t border-border pt-6">
          <Button type="submit" isLoading={updateBrandVoice.isPending}>
            Lưu Brand Voice
          </Button>
        </div>
      ) : (
        <p className="border-t border-border pt-6 text-sm text-muted">
          Chỉ Workspace Owner được chỉnh sửa Brand Voice.
        </p>
      )}
    </form>
  );
};

export default BrandVoiceForm;
