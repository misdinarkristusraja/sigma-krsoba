import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props   { children: React.ReactNode }
interface State   { hasError: boolean; error: Error | null; info: React.ErrorInfo | null; isChunkError: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const msg = error?.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    console.error('[SIGMA ErrorBoundary]', error, info?.componentStack);

    // Auto-reload once if chunk is missing due to new Vercel deployment
    const msg = error?.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk');

    if (isChunkError) {
      const pageHasReloaded = sessionStorage.getItem('eb_chunk_reload') === 'true';
      if (!pageHasReloaded) {
        sessionStorage.setItem('eb_chunk_reload', 'true');
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg   = this.state.error?.message || 'Unknown error';
    const stack = this.state.error?.stack?.split('\n').slice(0, 6).join('\n') || '';
    const isChunk = this.state.isChunkError;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isChunk ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {isChunk ? <RefreshCw size={32} className="animate-spin" /> : <AlertTriangle size={32} />}
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            {isChunk ? 'Versi Aplikasi Diperbarui' : 'Terjadi Kesalahan'}
          </h1>

          <p className="text-gray-500 text-sm">
            {isChunk
              ? 'Aplikasi SIGMA baru saja diperbarui di server. Silakan muat ulang halaman untuk mendapatkan versi terbaru.'
              : 'Halaman mengalami error. Screenshot dan kirim ke developer.'}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-200">
            <p className="text-red-700 text-xs font-mono break-all">{msg}</p>
            {!isChunk && stack && (
              <pre className="text-gray-400 text-[10px] mt-2 whitespace-pre-wrap break-all">
                {stack}
              </pre>
            )}
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => {
                sessionStorage.removeItem('eb_chunk_reload');
                sessionStorage.removeItem('chunk_reload_retry');
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn-primary gap-2"
            >
              <RefreshCw size={15} /> Muat Ulang Halaman
            </button>

            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="btn-outline"
            >
              Ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
