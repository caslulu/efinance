import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NotFoundPage = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <LayoutDashboard size={40} className="text-blue-600" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-7xl font-black text-gray-200">404</h1>
                    <h2 className="text-2xl font-bold text-gray-900">Página não encontrada</h2>
                    <p className="text-gray-500">
                        A página que você procura não existe ou foi movida.
                    </p>
                </div>

                <Button asChild size="lg" className="gap-2">
                    <Link to="/">
                        <ArrowLeft size={18} />
                        Voltar ao início
                    </Link>
                </Button>
            </div>
        </div>
    );
};
