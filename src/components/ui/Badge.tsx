import React from 'react';
import { cn } from '@/lib/utils';
import type { UserRole, UserStatus } from '@/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700',
  success: 'bg-green-100 text-green-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-green-200 dark:border-emerald-800/60',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-amber-950/80 dark:text-amber-300 border border-yellow-200 dark:border-amber-800/60',
  danger:  'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800/60',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60',
  purple:  'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      variantClasses[variant],
      className,
    )}>
      {children}
    </span>
  );
}

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  Administrator:    'danger',
  Pengurus:         'purple',
  Pelatih:          'info',
  Pendamping:       'info',
  Misdinar_Aktif:   'success',
  Misdinar_Retired: 'default',
};

const ROLE_LABEL: Record<UserRole, string> = {
  Administrator:    'Admin',
  Pengurus:         'Pengurus',
  Pelatih:          'Pelatih',
  Pendamping:       'Pendamping',
  Misdinar_Aktif:   'Aktif',
  Misdinar_Retired: 'Retired',
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={ROLE_VARIANT[role]}>{ROLE_LABEL[role]}</Badge>;
}

const STATUS_VARIANT: Record<UserStatus, BadgeVariant> = {
  Active:    'success',
  Pending:   'warning',
  Retired:   'default',
  Suspended: 'danger',
};

const STATUS_LABEL: Record<UserStatus, string> = {
  Active:    'Aktif',
  Pending:   'Menunggu',
  Retired:   'Pensiun',
  Suspended: 'Disuspend',
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
