import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import { useLogout } from '@/hooks/useAuth';
import { syncSessionUser, useInviteDetails } from '@/hooks/useWorkspace';
import { getErrorMessage, getErrorStatus } from '@/utils/error';

export const InvitePage = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const logout = useLogout();
  const inviteQuery = useInviteDetails(token);
  const handledRef = useRef(false);

  useEffect(() => {
    const data = inviteQuery.data;
    if (!data || handledRef.current || !('workspaceId' in data)) return;

    handledRef.current = true;
    toast.success(
      data.alreadyMember ? 'Bạn đã là thành viên của workspace' : `Đã tham gia ${data.workspaceName}`
    );

    void syncSessionUser()
      .catch((syncError) => console.error('Không đồng bộ được phiên đăng nhập', syncError))
      .finally(() => navigate('/'));
  }, [inviteQuery.data, navigate]);

  if (inviteQuery.isLoading) {
    return (
      <AuthLayout title="Lời mời tham gia" subtitle="Đang kiểm tra lời mời...">
        <p className="text-sm text-muted">Đang tải...</p>
      </AuthLayout>
    );
  }

  if (inviteQuery.isError) {
    const status = getErrorStatus(inviteQuery.error);
    const message =
      status === 403
        ? 'Lời mời này dành cho một email khác. Hãy đăng xuất và đăng nhập bằng đúng tài khoản được mời.'
        : getErrorMessage(inviteQuery.error);
    const loginUrl = `/login?redirect=${encodeURIComponent(`/invites/${token}`)}`;

    const handleSwitchAccount = () => {
      void logout
        .mutateAsync()
        .catch((logoutError) => console.error('Đăng xuất thất bại', logoutError))
        .finally(() => navigate(loginUrl));
    };

    return (
      <AuthLayout title="Không thể tham gia" subtitle="Lời mời không khả dụng">
        <p className="text-sm text-muted">{message}</p>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {status === 403 ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleSwitchAccount}
              isLoading={logout.isPending}
            >
              Đăng xuất và đăng nhập tài khoản khác
            </Button>
          ) : (
            <Link
              to={loginUrl}
              className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Đăng nhập
            </Link>
          )}
          <Link to="/" className="text-muted hover:text-foreground">
            Về trang tổng quan
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const data = inviteQuery.data;

  if (data && 'requiresRegistration' in data) {
    const registerUrl = `/register?email=${encodeURIComponent(data.email)}&redirect=${encodeURIComponent(
      `/invites/${token}`
    )}`;
    const loginUrl = `/login?redirect=${encodeURIComponent(`/invites/${token}`)}`;

    return (
      <AuthLayout
        title="Lời mời tham gia workspace"
        subtitle={`${data.workspaceName} đã mời bạn tham gia`}
      >
        <p className="text-sm text-muted">
          Bạn cần đăng ký tài khoản với email{' '}
          <span className="font-medium text-foreground">{data.email}</span> để tham gia.
        </p>
        <div className="mt-4 space-y-2">
          <Button type="button" className="w-full" onClick={() => navigate(registerUrl)}>
            Đăng ký để tham gia
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate(loginUrl)}
          >
            Đã có tài khoản? Đăng nhập
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đang tham gia workspace" subtitle="Vui lòng chờ trong giây lát">
      <p className="text-sm text-muted">Đang xử lý lời mời...</p>
    </AuthLayout>
  );
};

export default InvitePage;
