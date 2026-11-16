import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state';
import { dateLabel, num } from '../lib/format';

export default function Upload() {
  const { loadFile, loading, loadError, analysis, fileName } = useApp();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const handle = async (f: File | undefined | null) => {
    if (!f || loading) return;
    if (await loadFile(f)) nav('/overview');
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void handle(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 pt-2 sm:pt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">See where your M-PESA money goes</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Drop the SMS backup file exported by the <span className="font-medium">SMS Backup</span> app (a{' '}
          <code className="rounded bg-gray-100 px-1">.sms</code> or <code className="rounded bg-gray-100 px-1">.json</code> file). The
          M-PESA messages are read and summarised right here.
        </p>
      </div>

      <div
        aria-busy={loading}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? 'border-[#2f6fdb] bg-blue-50/40' : 'border-gray-300'}`}
      >
        {loading ? (
          <div role="status" className="flex flex-col items-center gap-3">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#2f6fdb]" aria-hidden />
            <span className="text-sm text-gray-600">Reading and analysing your messages…</span>
          </div>
        ) : (
          <>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6" aria-hidden>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm text-gray-800">Drop your backup file here, or</span>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Choose a file
            </button>
          </>
        )}
        <input
          ref={input}
          type="file"
          aria-label="Backup file"
          accept=".sms,.json,application/json,text/plain"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {loadError && (
        <div role="alert" className="rounded-md border border-red-200 px-3 py-2.5 text-sm text-red-700">
          <span className="font-medium">Couldn’t use that file.</span> {loadError}
        </div>
      )}

      {analysis && !loading && (
        <div className="rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
          Loaded <span className="break-all font-medium">{fileName}</span>: {num(analysis.summary.transactions)} transactions,{' '}
          {dateLabel(analysis.summary.first)} – {dateLabel(analysis.summary.last)}.{' '}
          <button type="button" onClick={() => nav('/overview')} className="font-medium text-[#2f6fdb] hover:underline">
            Open the dashboard →
          </button>
        </div>
      )}

      <div className="flex gap-2.5 rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-600">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="mt-0.5 shrink-0"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
        <p>
          <span className="font-medium text-gray-800">Private by design.</span> Your file is processed on this device and never uploaded.
          Nothing is stored except your settings; reload the page and the data is gone.
        </p>
      </div>
    </div>
  );
}
