import { useState, useRef, useEffect } from 'react';
import { Toaster } from 'sonner';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/pages/LoginPage';
import { RegisterPage } from './features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { DashboardPage } from './features/dashboard/pages/DashboardPage';
import { WalletsPage } from './features/wallets/pages/WalletsPage';
import { TransactionsPage } from './features/transactions/pages/TransactionsPage';
import { SubscriptionsPage } from './features/subscriptions/pages/SubscriptionsPage';
import { CategoriesPage } from './features/categories/pages/CategoriesPage';
import { SettingsPage } from './features/settings/pages/SettingsPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { BudgetsPage } from './features/budgets/pages/BudgetsPage';
import { WishlistPage } from './features/wishlist/pages/WishlistPage';
import { useMarkPriceAlertAsRead, usePriceAlertNotifications } from './hooks';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { NotFoundPage } from './features/404/NotFoundPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  ChevronDown,
  LogOut,
  Settings,
  LayoutDashboard,
  User,
  Wallet,
  ArrowLeftRight,
  Target,
  Gift,
  Repeat,
  Tags,
  Menu,
  X,
  Bell
} from 'lucide-react';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const NavLink = ({
  to,
  icon: Icon,
  label,
  isCollapsed,
  onClick
}: {
  to: string;
  icon: any;
  label: string;
  isCollapsed: boolean;
  onClick?: () => void
}) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <div className="relative group">
      <Link
        to={to}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-300 rounded-lg ${isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          } ${isCollapsed ? 'justify-center px-2' : ''}`}
        title={isCollapsed ? label : ''}
      >
        <Icon size={20} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
      {isCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </div>
  );
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/wallets': 'Minhas Carteiras',
  '/transactions': 'Histórico de Transações',
  '/budgets': 'Metas de Gastos',
  '/wishlists': 'Wishlist',
  '/subscriptions': 'Recorrências',
  '/categories': 'Categorias',
  '/profile': 'Perfil',
  '/settings': 'Configurações',
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const { data: priceAlerts } = usePriceAlertNotifications();
  const markAsRead = useMarkPriceAlertAsRead();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const pageTitle = PAGE_TITLES[location.pathname] || '';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r transition-all duration-300 lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        <div className="h-full flex flex-col">
          <div className={`p-6 flex items-center justify-between ${isCollapsed ? 'px-4' : ''}`}>
            <Link to="/" className={`flex items-center gap-2 font-bold text-blue-600 transition-all ${isCollapsed ? 'scale-110' : 'text-2xl'}`}>
              <LayoutDashboard size={isCollapsed ? 32 : 28} />
              {!isCollapsed && <span>FinanceApp</span>}
            </Link>
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} className="text-gray-500" />
            </button>
            {!isCollapsed && (
              <button
                className="hidden lg:block text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                onClick={() => setIsCollapsed(true)}
              >
                <ChevronDown size={20} className="rotate-90" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <div className="px-4 mb-4 flex justify-center">
              <button
                className="hidden lg:block text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
                onClick={() => setIsCollapsed(false)}
              >
                <ChevronDown size={20} className="-rotate-90" />
              </button>
            </div>
          )}

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            <NavLink to="/" icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/wallets" icon={Wallet} label="Carteiras" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/transactions" icon={ArrowLeftRight} label="Transações" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/budgets" icon={Target} label="Metas" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/wishlists" icon={Gift} label="Wishlist" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/subscriptions" icon={Repeat} label="Recorrências" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavLink to="/categories" icon={Tags} label="Categorias" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          </nav>

          <div className={`p-4 border-t ${isCollapsed ? 'px-2' : ''}`}>
            <button
              onClick={logout}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-all rounded-lg w-full ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={isCollapsed ? 'Sair' : ''}
            >
              <LogOut size={20} className="shrink-0" />
              {!isCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 -ml-2 text-gray-600"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 lg:flex-none">
            {pageTitle && (
              <h1 className="hidden lg:block text-lg font-semibold text-gray-800">{pageTitle}</h1>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Notificações"
                >
                  <Bell size={20} />
                  {!!priceAlerts?.unreadCount && (
                    <span className="absolute right-1 top-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {priceAlerts.unreadCount > 9 ? '9+' : priceAlerts.unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 lg:w-96 p-0 shadow-xl border-gray-200">
                <div className="border-b px-4 py-3 bg-gray-50 rounded-t-lg">
                  <p className="font-bold text-sm text-gray-900">Alertas de preço</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {priceAlerts?.notifications?.length ? (
                    priceAlerts.notifications.map((notification) => (
                      <button
                        key={notification.id}
                        className={`w-full border-b px-4 py-4 text-left hover:bg-blue-50 transition-colors ${notification.is_read ? 'bg-white opacity-60' : 'bg-blue-50/30'
                          }`}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead.mutate(notification.id);
                          }
                          if (notification.wishlistProduct.url) {
                            window.open(
                              notification.wishlistProduct.url,
                              '_blank',
                              'noopener,noreferrer',
                            );
                          }
                        }}
                      >
                        <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(notification.notified_at).toLocaleString('pt-BR')}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-gray-500">
                      Sem notificações no momento.
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 rounded-full lg:rounded-lg p-1 lg:px-3 lg:py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden border-2 border-white shadow-sm">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden lg:inline">{user?.username}</span>
                <ChevronDown size={16} className={`hidden lg:block transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-100">
                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User size={18} />
                      Perfil
                    </Link>
                    <Link
                      to="/settings"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings size={18} />
                      Configurações
                    </Link>
                    <div className="border-t my-1"></div>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={18} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallets"
            element={
              <ProtectedRoute>
                <Layout>
                  <WalletsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Layout>
                  <TransactionsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscriptions"
            element={
              <ProtectedRoute>
                <Layout>
                  <SubscriptionsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <CategoriesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <Layout>
                  <BudgetsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlists"
            element={
              <ProtectedRoute>
                <Layout>
                  <WishlistPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/perfil" element={<Navigate to="/profile" replace />} />
          <Route path="/configuracoes" element={<Navigate to="/settings" replace />} />
          <Route path="/settings/profile" element={<Navigate to="/profile" replace />} />
          <Route path="/configuracoes/perfil" element={<Navigate to="/profile" replace />} />
          <Route path="/settings/security" element={<Navigate to="/settings" replace />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}

export default App;
