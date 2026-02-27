import { LayoutDashboard } from 'lucide-react';

export const LoadingSpinner = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
            <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse shadow-lg shadow-blue-200">
                    <LayoutDashboard size={32} className="text-white" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:300ms]" />
            </div>
        </div>
    );
};
