import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WalletCard } from './WalletCard';
import type { Wallet } from '../../../types/Wallet';
import type { Card } from '../../../types/Card';

interface SortableWalletCardProps {
    wallet: Wallet;
    cards: Card[];
    onAddFunds: () => void;
    onAddExpense: () => void;
    onEdit: () => void;
    onAddCard: () => void;
    onEditCard: (card: Card) => void;
    onAddCardExpense: (card: Card) => void;
    onPayCardInvoice: (card: Card) => void;
}

export const SortableWalletCard: React.FC<SortableWalletCardProps> = ({
    wallet,
    cards,
    onAddFunds,
    onAddExpense,
    onEdit,
    onAddCard,
    onEditCard,
    onAddCardExpense,
    onPayCardInvoice,
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
                cards={cards}
                onAddFunds={onAddFunds}
                onAddExpense={onAddExpense}
                onEdit={onEdit}
                onAddCard={onAddCard}
                onEditCard={onEditCard}
                onAddCardExpense={onAddCardExpense}
                onPayCardInvoice={onPayCardInvoice}
            />
        </div>
    );
};
