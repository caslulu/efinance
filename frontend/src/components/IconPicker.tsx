import * as LucideIcons from 'lucide-react';
import {
  SiNetflix, SiSpotify, SiUber, SiIfood, SiOpenai, SiGoogle,
  SiApple, SiPlaystation,
  SiSteam, SiDiscord, SiTwitch, SiYoutube, SiInstagram,
  SiTiktok, SiWhatsapp, SiTelegram, SiNubank, SiMercadopago,
  SiX, SiAirbnb, SiTinder, SiShopee, SiAliexpress,
  SiCrunchyroll, SiHbo, SiPatreon, SiVimeo
} from 'react-icons/si';
import { FaCcVisa, FaCcMastercard, FaCcAmex, FaAmazon, FaLinkedin } from 'react-icons/fa';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export const ICON_LIST = [
  'Utensils', 'Car', 'Home', 'ShoppingBag', 'Heart', 'GraduationCap', 'Plane', 
  'Gamepad2', 'Zap', 'DollarSign', 'Briefcase', 'PiggyBank', 'CreditCard',
  'Coffee', 'Pizza', 'Beer', 'Apple', 'Smartphone', 'Tv', 'Laptop',
  'Bike', 'Bus', 'Train', 'Fuel', 'Stethoscope', 'Pill', 'Dumbbell',
  'Scissors', 'Shirt', 'Watch', 'Gift', 'Camera', 'Music', 'Gamepad',
  'Trash2', 'Wrench', 'Hammer', 'Plug', 'Droplets', 'Sun', 'Moon',
  'Umbrella', 'Cloud', 'Trees', 'Anchor', 'Ship', 'Truck', 'Award'
] as const;

export const BRAND_ICONS: Record<string, React.ElementType> = {
  SiNetflix, SiSpotify, SiUber, SiIfood, SiOpenai, SiGoogle,
  SiApple, SiPlaystation,
  SiSteam, SiDiscord, SiTwitch, SiYoutube, SiInstagram,
  SiTiktok, SiWhatsapp, SiTelegram, SiNubank, SiMercadopago,
  SiX, SiAirbnb, SiTinder, SiShopee, SiAliexpress,
  SiCrunchyroll, SiHbo, SiPatreon, SiVimeo,
  FaCcVisa, FaCcMastercard, FaCcAmex, FaAmazon, FaLinkedin
};

export type IconName = typeof ICON_LIST[number] | keyof typeof BRAND_ICONS;

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [tab, setTab] = useState<'geral' | 'marcas'>('geral');

  let SelectedIcon: React.ElementType | null = null;
  if (value) {
    if (BRAND_ICONS[value]) {
      SelectedIcon = BRAND_ICONS[value];
    } else {
      SelectedIcon = LucideIcons[value as keyof typeof LucideIcons] as React.ElementType;
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="w-10 h-10 p-0 shrink-0 flex items-center justify-center shadow-sm">
          {SelectedIcon ? <SelectedIcon className="h-5 w-5" /> : <LucideIcons.ImagePlus className="h-5 w-5 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 border border-border shadow-xl">
        <div className="flex border-b bg-muted/30">
          <button 
            type="button"
            className={cn("flex-1 py-2 text-xs font-bold transition-colors", tab === 'geral' ? "border-b-2 border-emerald-500 text-emerald-600" : "text-muted-foreground")}
            onClick={(e) => { e.preventDefault(); setTab('geral'); }}
          >
            Geral
          </button>
          <button 
            type="button"
            className={cn("flex-1 py-2 text-xs font-bold transition-colors", tab === 'marcas' ? "border-b-2 border-emerald-500 text-emerald-600" : "text-muted-foreground")}
            onClick={(e) => { e.preventDefault(); setTab('marcas'); }}
          >
            Marcas
          </button>
        </div>
        <ScrollArea className="h-72 p-4">
          <div className="grid grid-cols-6 gap-2">
            {tab === 'geral' && ICON_LIST.map((iconName) => {
              const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as React.ElementType;
              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  type="button"
                  title={iconName}
                  className={cn(
                    "h-10 w-10 text-muted-foreground hover:text-foreground",
                    value === iconName && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  )}
                  onClick={() => onChange(iconName)}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              );
            })}

            {tab === 'marcas' && Object.entries(BRAND_ICONS).map(([iconName, Icon]) => {
              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  type="button"
                  title={iconName.replace(/Si|FaCc/, '')}
                  className={cn(
                    "h-10 w-10 text-muted-foreground hover:text-foreground",
                    value === iconName && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
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
  let Icon: React.ElementType = LucideIcons.HelpCircle as React.ElementType;

  if (name) {
    if (BRAND_ICONS[name]) {
      Icon = BRAND_ICONS[name];
    } else if (LucideIcons[name as keyof typeof LucideIcons]) {
      Icon = LucideIcons[name as keyof typeof LucideIcons] as React.ElementType;
    }
  }

  return <Icon className={className} />;
};
