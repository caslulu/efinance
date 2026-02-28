import React from 'react';
import { NumericFormat, type NumericFormatProps } from 'react-number-format';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<NumericFormatProps, 'value' | 'onValueChange' | 'onChange' | 'customInput'> {
  value: string | number | undefined;
  onValueChange: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, id, required, ...props }, ref) => {
    return (
      <NumericFormat
        id={id}
        value={value}
        onValueChange={(values) => {
          onValueChange(values.value);
        }}
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        customInput={Input}
        className={cn('w-full', className)}
        required={required}
        getInputRef={ref}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';