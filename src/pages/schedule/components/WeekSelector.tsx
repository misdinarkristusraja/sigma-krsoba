import React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

interface WeekSelectorProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  onRefresh: () => void;
}

export function WeekSelector({ month, year, onPrev, onNext, onRefresh }: WeekSelectorProps) {
  return (
    <div className="flex gap-2 items-center">
      <button onClick={onPrev}    className="btn-ghost p-2"><ChevronLeft  size={18}/></button>
      <span className="font-semibold text-gray-700 w-36 text-center">{MONTHS[month-1]} {year}</span>
      <button onClick={onNext}    className="btn-ghost p-2"><ChevronRight size={18}/></button>
      <button onClick={onRefresh} className="btn-ghost p-2"><RefreshCw    size={16}/></button>
    </div>
  );
}
