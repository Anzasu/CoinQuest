import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Text, HelperText } from 'react-native-paper';
import { useAppTheme } from '@/hooks/useAppTheme';
import { parseEuroInput } from '@/lib/money';

interface MoneyInputProps {
  label: string;
  valueCents: number | null;
  onChange: (cents: number | null) => void;
  error?: string;
  disabled?: boolean;
}

export function MoneyInput({ label, valueCents, onChange, error, disabled }: MoneyInputProps) {
  const theme = useAppTheme();
  const lastEmittedValue = useRef<number | null>(valueCents);
  const [raw, setRaw] = useState(
    valueCents != null ? (valueCents / 100).toFixed(2).replace('.', ',') : '',
  );

  useEffect(() => {
    if (valueCents === lastEmittedValue.current) return;
    lastEmittedValue.current = valueCents;
    setRaw(valueCents != null ? (valueCents / 100).toFixed(2).replace('.', ',') : '');
  }, [valueCents]);

  function handleChange(text: string) {
    setRaw(text);
    const parsed = parseEuroInput(text);
    lastEmittedValue.current = parsed;
    onChange(parsed);
  }

  function handleBlur() {
    if (valueCents != null) {
      const euros = Math.floor(valueCents / 100);
      const cents = valueCents % 100;
      setRaw(`${euros},${cents.toString().padStart(2, '0')}`);
    }
  }

  return (
    <View>
      <TextInput
        label={label}
        value={raw}
        onChangeText={handleChange}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        mode="outlined"
        left={<TextInput.Affix text="€" />}
        error={!!error}
        disabled={disabled}
        style={{ backgroundColor: theme.colors.surface }}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}
