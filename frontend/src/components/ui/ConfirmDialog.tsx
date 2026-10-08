import { type ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';

type ConfirmTone = 'default' | 'danger';

export const ConfirmDialog = ({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'default',
  isLoading = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  onConfirm: () => void;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          isLoading={isLoading}
          className={tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : undefined}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-muted">{description}</div>
  </Modal>
);

export default ConfirmDialog;
