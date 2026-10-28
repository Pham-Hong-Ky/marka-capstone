import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';

export const LinkDialog = ({
  open,
  value,
  hasLink,
  onChange,
  onApply,
  onRemove,
  onClose,
}: {
  open: boolean;
  value: string;
  hasLink: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Liên kết"
    footer={
      <>
        {hasLink ? (
          <Button
            type="button"
            variant="outline"
            className="mr-auto text-danger"
            onClick={onRemove}
          >
            Gỡ liên kết
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="button" onClick={onApply}>
          Áp dụng
        </Button>
      </>
    }
  >
    <TextField
      label="URL"
      name="url"
      placeholder="https://..."
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onApply();
        }
      }}
    />
  </Modal>
);

export default LinkDialog;
