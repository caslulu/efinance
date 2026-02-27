import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WalletCard } from './WalletCard';
import type { Wallet } from '../../../types/Wallet';

interface SortableWalletCardProps {
    wallet: Wallet;
    onAddFunds: () => void;
    onAddExpense: () => void;
    onEdit: () => void;
    onPayInvoice: () => void;
}

export const SortableWalletCard: React.FC<SortableWalletCardProps> = ({
    wallet,
    onAddFunds,
    onAddExpense,
    onEdit,
    onPayInvoice,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: wallet.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <WalletCard
                wallet={wallet}
                onAddFunds={onAddFunds}
                onAddExpense={onAddExpense}
                onEdit={onEdit}
                onPayInvoice={onPayInvoice}
            />
        </div>
    );
};
