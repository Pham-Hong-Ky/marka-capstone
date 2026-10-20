import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/button.styles';

export const ComingSoonPage = ({ title }: { title: string }) => (
  <div className="mx-auto max-w-xl py-24 text-center">
    <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
    <p className="mt-2 text-sm text-muted">
      Phân hệ này chưa được triển khai. Sẽ được bổ sung theo lộ trình.
    </p>
    <Link to="/" className={buttonClasses('outline', 'mt-6')}>
      Về trang tổng quan
    </Link>
  </div>
);

export default ComingSoonPage;
