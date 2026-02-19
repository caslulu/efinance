import * as Icons from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

export const ICON_LIST = [
  'Utensils', 'Car', 'Home', 'ShoppingBag', 'Heart', 'GraduationCap', 'Plane', 
  'Gamepad2', 'Zap', 'DollarSign', 'Briefcase', 'PiggyBank', 'CreditCard',
  'Coffee', 'Pizza', 'Beer', 'Apple', 'Smartphone', 'Tv', 'Laptop',
  'Bike', 'Bus', 'Train', 'Fuel', 'Stethoscope', 'Pill', 'Dumbbell',
  'Scissors', 'Shirt', 'Watch', 'Gift', 'Camera', 'Music', 'Gamepad',
  'Trash2', 'Wrench', 'Hammer', 'Plug', 'Droplets', 'Sun', 'Moon',
  'Umbrella', 'Cloud', 'Trees', 'Anchor', 'Ship', 'Truck', 'Award'
] as const;

export type IconName = typeof ICON_LIST[number];

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const SelectedIcon = value ? (Icons[value as keyof typeof Icons] as Icons.LucideIcon) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          {SelectedIcon ? <SelectedIcon className="h-4 w-4" /> : <Icons.HelpCircle className="h-4 w-4" />}
          {value || 'Selecionar ícone'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <ScrollArea className="h-72 p-4">
          <div className="grid grid-cols-6 gap-2">
            {ICON_LIST.map((iconName) => {
              const Icon = Icons[iconName as keyof typeof Icons] as Icons.LucideIcon;
              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  type="button"
                  className={cn(
                    "h-10 w-10",
                    value === iconName && "bg-accent"
                  )}
                  onClick={() => onChange(iconName)}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export const CategoryIcon = ({ name, className }: { name?: string, className?: string }) => {
  const Icon = (name && Icons[name as keyof typeof Icons] ? Icons[name as keyof typeof Icons] : Icons.HelpCircle) as Icons.LucideIcon;
  return <Icon className={className} />;
};
