import { useMemo } from 'react';

interface PasswordStrengthIndicatorProps {
    password: string;
}

const getStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: 'bg-gray-200' };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500' };
    if (score <= 2) return { score: 2, label: 'Média', color: 'bg-orange-500' };
    if (score <= 3) return { score: 3, label: 'Forte', color: 'bg-yellow-500' };
    return { score: 4, label: 'Muito Forte', color: 'bg-green-500' };
};

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
    const strength = useMemo(() => getStrength(password), [password]);

    if (!password) return null;

    return (
        <div className="space-y-1.5 pt-1">
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                    <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${level <= strength.score ? strength.color : 'bg-gray-200'
                            }`}
                    />
                ))}
            </div>
            <p className={`text-xs font-medium ${strength.score <= 1 ? 'text-red-600' :
                    strength.score <= 2 ? 'text-orange-600' :
                        strength.score <= 3 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                Força: {strength.label}
            </p>
        </div>
    );
};
