import { useState, useRef, useEffect, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { useProject } from '@/context/ProjectContext';

type NumberFormat = 'comma-period' | 'period-comma' | 'space-comma';

function getSeparators(fmt: NumberFormat) {
  switch (fmt) {
    case 'period-comma': return { thousands: '.', decimal: ',' };
    case 'space-comma': return { thousands: '\u00A0', decimal: ',' };
    default: return { thousands: ',', decimal: '.' };
  }
}

function formatWithSeparators(raw: string, fmt: NumberFormat): string {
  const { thousands, decimal } = getSeparators(fmt);
  const parts = raw.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  if (parts.length > 1) {
    return intPart + decimal + parts[1];
  }
  return intPart;
}

function stripToRaw(display: string, fmt: NumberFormat): string {
  const { thousands, decimal } = getSeparators(fmt);
  let result = '';
  let hasDecimal = false;
  for (const ch of display) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === thousands || (ch === ' ' || ch === '\u00A0')) {
      continue;
    } else if (ch === decimal && !hasDecimal) {
      result += '.';
      hasDecimal = true;
    }
  }
  return result;
}

function normalizeIncoming(v: number | string, fmt: NumberFormat): string {
  if (typeof v === 'number') return v.toString();
  const { thousands, decimal } = getSeparators(fmt);
  let result = '';
  let hasDecimal = false;
  for (const ch of v) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === thousands) {
      continue;
    } else if (ch === decimal && !hasDecimal) {
      result += '.';
      hasDecimal = true;
    }
  }
  return result;
}

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | string | null | undefined;
  onChange: (value: number | null) => void;
}

export function CurrencyInput({ value, onChange, ...rest }: CurrencyInputProps) {
  const { regionalContext } = useProject();
  const fmt = regionalContext?.numberFormat ?? 'comma-period';
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  const toDisplay = (v: number | string | null | undefined): string => {
    if (v === null || v === undefined || v === '') return '';
    const normalized = normalizeIncoming(v, fmt);
    const num = parseFloat(normalized);
    if (isNaN(num)) return '';
    return formatWithSeparators(num.toString(), fmt);
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  useEffect(() => {
    if (cursorRef.current !== null) return;
    const incoming = toDisplay(value);
    const currentRaw = stripToRaw(display, fmt);
    const incomingRaw = stripToRaw(incoming, fmt);
    if (currentRaw !== incomingRaw) {
      setDisplay(incoming);
    }
  }, [value]);

  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const rawInput = el.value;
    const caretPos = el.selectionStart ?? rawInput.length;

    const stripped = stripToRaw(rawInput, fmt);

    if (stripped === '' || stripped === '.') {
      setDisplay('');
      onChange(null);
      cursorRef.current = caretPos > 0 ? 0 : null;
      return;
    }

    const endsWithDecimal = stripped.endsWith('.');
    const formatted = formatWithSeparators(stripped, fmt);

    const { decimal } = getSeparators(fmt);
    const finalDisplay = endsWithDecimal && !formatted.includes(decimal)
      ? formatted + decimal
      : formatted;

    const charsBeforeCaret = rawInput.slice(0, caretPos);
    const digitsBeforeCaret = stripToRaw(charsBeforeCaret, fmt).replace('.', '').length;
    const decimalBeforeCaret = stripToRaw(charsBeforeCaret, fmt).includes('.');

    let newCaret = 0;
    let seen = 0;
    let passedDecimal = false;
    for (let i = 0; i < finalDisplay.length; i++) {
      const ch = finalDisplay[i];
      const isDigit = ch >= '0' && ch <= '9';
      const isDec = ch === decimal;

      if (isDigit) {
        seen++;
        if (seen > digitsBeforeCaret && (!decimalBeforeCaret || passedDecimal || seen > digitsBeforeCaret)) {
          break;
        }
      } else if (isDec) {
        passedDecimal = true;
        if (decimalBeforeCaret && seen >= digitsBeforeCaret) {
          newCaret = i + 1;
          break;
        }
      }
      newCaret = i + 1;
    }

    setDisplay(finalDisplay);
    cursorRef.current = newCaret;

    if (!endsWithDecimal) {
      const parsed = parseFloat(stripped);
      onChange(isNaN(parsed) ? null : parsed);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      {...rest}
    />
  );
}
