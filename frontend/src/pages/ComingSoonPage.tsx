import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
}

export const ComingSoonPage = ({ title }: ComingSoonPageProps) => (
  <div className="mx-auto max-w-2xl py-20 text-center">
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
      <Construction className="h-7 w-7 text-indigo-400" />
    </div>
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    <p className="mt-2 text-sm text-muted">
      Phân hệ này chưa được triển khai. Sẽ được bổ sung theo lộ trình.
    </p>
    <Link
      to="/"
      className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
    >
      Về trang tổng quan
    </Link>
  </div>
);

export default ComingSoonPage;
