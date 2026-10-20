import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/button.styles';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PostStatusBadge from '@/components/features/post/PostStatusBadge';
import { useChannels } from '@/hooks/useChannels';
import { usePosts } from '@/hooks/usePost';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { formatNumber, formatDate } from '@/utils/format';

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="px-5 py-4">
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</dd>
  </div>
);

export const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const posts = usePosts(workspaceId, { page: 1, limit: 5 });
  const channels = useChannels(workspaceId);

  if (!activeWorkspace) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để bắt đầu soạn nội dung."
      />
    );
  }

  const recentPosts = posts.data?.posts ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title={`Xin chào, ${user?.name ?? 'bạn'}`}
        description={`Tổng quan workspace ${activeWorkspace.name}.`}
      />

      <dl className="grid divide-y divide-border rounded-2xl border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Bài viết" value={posts.data ? formatNumber(posts.data.meta.total) : '—'} />
        <Stat
          label="Kênh đã kết nối"
          value={channels.data ? formatNumber(channels.data.channels.length) : '—'}
        />
        <Stat label="Credit còn lại" value={formatNumber(activeWorkspace.remainingCredit)} />
      </dl>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">Bài viết gần đây</h2>
          {recentPosts.length > 0 ? (
            <Link to="/posts" className="text-sm text-accent-text hover:underline">
              Xem tất cả
            </Link>
          ) : null}
        </div>

        {posts.isLoading ? <SkeletonList rows={5} /> : null}

        {posts.isError ? (
          <p className="text-sm text-danger">{getErrorMessage(posts.error)}</p>
        ) : null}

        {posts.data && recentPosts.length === 0 ? (
          <EmptyState
            title="Chưa có bài viết nào."
            description="Soạn bài viết đầu tiên để bắt đầu quy trình duyệt và đăng bài."
            action={
              <Link to="/posts/new" className={buttonClasses('outline')}>
                Tạo bài viết
              </Link>
            }
          />
        ) : null}

        {recentPosts.length > 0 ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {recentPosts.map((post) => (
              <li key={post.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {post.title}
                </span>
                <PostStatusBadge status={post.status} />
                <span className="hidden w-24 text-right text-sm text-muted tabular-nums sm:block">
                  {formatDate(post.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
};

export default DashboardPage;
