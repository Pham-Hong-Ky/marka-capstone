import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface GoogleLoginButtonProps {
  onSuccess: (idToken: string) => void;
}

const MAX_WIDTH = 400;

export const GoogleLoginButton = ({ onSuccess }: GoogleLoginButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setWidth(Math.min(element.offsetWidth, MAX_WIDTH));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      toast.error('Không nhận được thông tin từ Google');
      return;
    }
    onSuccess(response.credential);
  };

  return (
    <div ref={containerRef} className="flex w-full justify-center">
      {width > 0 && (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => toast.error('Đăng nhập Google thất bại')}
          theme={resolvedTheme === 'dark' ? 'filled_black' : 'outline'}
          shape="rectangular"
          size="large"
          text="continue_with"
          width={width}
        />
      )}
    </div>
  );
};

export default GoogleLoginButton;
