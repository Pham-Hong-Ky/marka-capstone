import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <div className="mx-auto max-w-xl py-24 text-center">
    <p className="text-5xl font-bold text-indigo-400">404</p>
    <h1 className="mt-3 text-xl font-semibold text-white">Không tìm thấy trang</h1>
    <p className="mt-2 text-sm text-slate-400">Đường dẫn bạn truy cập không tồn tại.</p>
    <Link
      to="/"
      className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
    >
      Về trang tổng quan
    </Link>
  </div>
);

export default NotFoundPage;
