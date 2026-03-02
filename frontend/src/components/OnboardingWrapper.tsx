import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/hooks';

export const OnboardingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const { data: wallets, isLoading, isFetching } = useWallets();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading && !isFetching && wallets && wallets.length === 0) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isLoading, isFetching, wallets, navigate]);

  return <>{children}</>;
};