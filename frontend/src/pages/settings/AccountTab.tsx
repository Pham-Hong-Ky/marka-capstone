import ChangePasswordForm from '@/components/features/account/ChangePasswordForm';
import DeleteAccountCard from '@/components/features/account/DeleteAccountCard';
import ProfileForm from '@/components/features/account/ProfileForm';
import SessionSecurityCard from '@/components/features/account/SessionSecurityCard';

export const AccountTab = () => (
  <div className="space-y-6">
    <ProfileForm />
    <ChangePasswordForm />
    <SessionSecurityCard />
    <DeleteAccountCard />
  </div>
);

export default AccountTab;
