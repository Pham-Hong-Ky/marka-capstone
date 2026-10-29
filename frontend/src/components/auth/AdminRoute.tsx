import { Link, Outlet } from 'react-router-dom';
import EmptyState from '@/components/ui/EmptyState';
import { buttonClasses } from '@/components/ui/button.styles';
import { useAuthStore } from '@/stores/auth.store';

export const AdminRoute = () => {
  const user = useAuthStore((state) => state.user);

  if (user?.systemRole !== 'SYSTEM_ADMIN') {
    return (
      <EmptyState
        title="Không có quyền truy cập"
        description="Khu quản trị chỉ dành cho quản trị viên hệ thống."
        action={
          <Link to="/" className={buttonClasses('outline', 'min-h-11')}>
            Về trang tổng quan
          </Link>
        }
      />
    );
  }

  return <Outlet />;
};

export default AdminRoute;
