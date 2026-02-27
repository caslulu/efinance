export interface User {
    id: number;
    username: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    birthDate?: string;
    isTwoFactorEnabled: boolean;
    isEmailVerified: boolean;
}
