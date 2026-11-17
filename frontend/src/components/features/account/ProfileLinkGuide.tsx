import { useState } from 'react';
import { Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const GUIDES = {
  Facebook: {
    steps: [
      'Mở Facebook trên trình duyệt và vào trang cá nhân của bạn (bấm vào ảnh đại diện).',
      'Sao chép địa chỉ trên thanh địa chỉ của trình duyệt. Trên ứng dụng điện thoại: bấm nút ba chấm (⋯) dưới ảnh bìa, chọn "Sao chép liên kết".',
      'Dán vào ô Facebook, ví dụ: https://www.facebook.com/ten-ban',
    ],
  },
  Threads: {
    steps: [
      'Mở Threads và vào trang hồ sơ của bạn.',
      'Trên ứng dụng: bấm biểu tượng chia sẻ hoặc nút ba chấm (⋯), chọn "Sao chép liên kết". Trên trình duyệt: sao chép địa chỉ trên thanh địa chỉ.',
      'Dán vào ô Threads, ví dụ: https://www.threads.com/@ten-ban',
    ],
  },
} as const;

export const ProfileLinkGuide = ({ platform }: { platform: keyof typeof GUIDES }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Hướng dẫn lấy link ${platform}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Info className="h-4 w-4" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Cách lấy link ${platform}`}
        footer={<Button onClick={() => setOpen(false)}>Đã hiểu</Button>}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          {GUIDES[platform].steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Modal>
    </>
  );
};

export default ProfileLinkGuide;
