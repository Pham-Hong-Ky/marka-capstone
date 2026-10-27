import Avatar from '@/components/ui/Avatar';
import ImageUploadField from '@/components/ui/ImageUploadField';

export const AvatarField = ({
  name,
  avatar,
  isUploading,
  onSelect,
}: {
  name: string;
  avatar: string | null;
  isUploading: boolean;
  onSelect: (file: File) => void;
}) => (
  <div className="flex items-center gap-4">
    <Avatar name={name} src={avatar} className="h-16 w-16 text-lg" />
    <div className="flex-1 space-y-1.5">
      <ImageUploadField
        id="avatar-upload"
        label="Ảnh đại diện"
        hint="JPG, PNG hoặc WEBP, tối đa 2MB."
        maxSize={2 * 1024 * 1024}
        disabled={isUploading}
        onSelect={onSelect}
      />
      {isUploading ? <p className="text-xs text-muted">Đang tải ảnh...</p> : null}
    </div>
  </div>
);

export default AvatarField;
