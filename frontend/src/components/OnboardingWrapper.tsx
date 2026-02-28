import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/hooks';

export const OnboardingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const { data: wallets, isLoading } = useWallets();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading && wallets && wallets.length === 0) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isLoading, wallets, navigate]);

  return <>{children}</>;
};