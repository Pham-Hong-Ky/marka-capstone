import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/button.styles';

export const NotFoundPage = () => (
  <div className="mx-auto max-w-xl py-24 text-center">
    <p className="font-mono text-sm text-muted">404</p>
    <h1 className="mt-2 text-2xl font-semibold text-foreground">Không tìm thấy trang</h1>
    <p className="mt-2 text-sm text-muted">Đường dẫn bạn truy cập không tồn tại.</p>
    <Link to="/" className={buttonClasses('primary', 'mt-6')}>
      Về trang tổng quan
    </Link>
  </div>
);

export default NotFoundPage;
