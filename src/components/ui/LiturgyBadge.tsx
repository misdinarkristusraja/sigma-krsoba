import React from 'react';
import { cn } from '@/lib/utils';
import { LITURGY_COLORS } from '@/lib/utils';

type WarnaLiturgi = 'Hijau' | 'Merah' | 'Putih' | 'Ungu' | 'MerahMuda' | 'Hitam';

interface LiturgyBadgeProps {
  warna?: WarnaLiturgi | string;
  className?: string;
}

export function LiturgyBadge({ warna, className }: LiturgyBadgeProps) {
  const lc = LITURGY_COLORS[warna as WarnaLiturgi] || LITURGY_COLORS['Hijau'];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      lc.bg, lc.text,
      className,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', lc.dot)} />
      {lc.label}
    </span>
  );
}

export function LiturgyDot({ warna, className }: LiturgyBadgeProps) {
  const lc = LITURGY_COLORS[warna as WarnaLiturgi] || LITURGY_COLORS['Hijau'];
  return <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', lc.dot, className)} />;
}
