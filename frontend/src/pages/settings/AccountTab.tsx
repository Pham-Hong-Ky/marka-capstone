import ChangePasswordForm from '@/components/features/account/ChangePasswordForm';
import DeleteAccountCard from '@/components/features/account/DeleteAccountCard';
import ProfileForm from '@/components/features/account/ProfileForm';
import SessionSecurityCard from '@/components/features/account/SessionSecurityCard';
import { useAuthStore } from '@/stores/auth.store';

export const AccountTab = () => {
  const hasPassword = useAuthStore((state) => state.user?.hasPassword);

  return (
    <div className="space-y-4">
      <ProfileForm />
      {hasPassword ? <ChangePasswordForm /> : null}
      <SessionSecurityCard />
      <DeleteAccountCard />
    </div>
  );
};

export default AccountTab;
