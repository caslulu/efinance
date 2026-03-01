import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Menu,
  Target,
  Gift,
  Repeat,
  Tags,
  Settings,
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NavItem = ({ to, icon: Icon, label, onClick }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
        isActive ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100'
      }`}
    >
      <Icon size={20} className={isActive ? 'fill-blue-50/50' : ''} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
};

export const BottomNav = () => {
  const { logout } = useAuth();
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card dark:bg-gray-950 border-t border-border dark:border-gray-800 flex items-center justify-around px-2 z-50 pb-safe">
      <NavItem to="/" icon={LayoutDashboard} label="Início" />
      <NavItem to="/wallets" icon={Wallet} label="Carteiras" />
      <NavItem to="/transactions" icon={ArrowLeftRight} label="Transações" />
      
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100 transition-colors">
            <Menu size={20} />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted dark:bg-gray-900 rounded-xl">
            <NavItem to="/budgets" icon={Target} label="Metas" />
            <NavItem to="/wishlists" icon={Gift} label="Wishlist" />
            <NavItem to="/subscriptions" icon={Repeat} label="Assinaturas" />
            <NavItem to="/categories" icon={Tags} label="Categorias" />
            <NavItem to="/profile" icon={User} label="Perfil" />
            <NavItem to="/settings" icon={Settings} label="Ajustes" />
          </div>

          <div className="mt-8 px-4">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-500 font-medium hover:bg-red-100 transition-colors"
            >
              <LogOut size={18} />
              Sair da Conta
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};