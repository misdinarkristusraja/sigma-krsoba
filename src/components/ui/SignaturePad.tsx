import React, { useRef, useEffect } from 'react';
import SigPad from 'signature_pad';
import { RotateCcw } from 'lucide-react';

interface Props {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

export default function SignaturePad({ onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef    = useRef<SigPad | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SigPad(canvas, { minWidth: 1.2, maxWidth: 3, penColor: '#1e3a5f' });
    padRef.current = pad;

    function resize() {
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = canvas.offsetWidth;
      const data = pad.toData();
      canvas.width  = w * ratio;
      canvas.height = height * ratio;
      canvas.getContext('2d')!.scale(ratio, ratio);
      pad.clear();
      if (data.length) {
        pad.fromData(data);
        onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'));
      } else {
        onChange(null);
      }
    }

    pad.addEventListener('endStroke', () => {
      onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'));
    });

    window.addEventListener('resize', resize);
    resize();

    return () => {
      window.removeEventListener('resize', resize);
      pad.off();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function clear() {
    padRef.current?.clear();
    onChange(null);
  }

  return (
    <div>
      <div
        className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 pointer-events-none select-none">
          Tanda tangan di sini
        </span>
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <RotateCcw size={12} /> Hapus tanda tangan
      </button>
    </div>
  );
}
