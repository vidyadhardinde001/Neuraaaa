import { useEffect } from "react";

export default function DuplicateSearchProgressModal({ shown, progress, cancel }: any) {
  if (!shown) return null;

  const scanned = progress?.scanned ?? 0;
  const candidates = progress?.candidates ?? 0;
  const duplicates = progress?.duplicates_found ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gradient-to-tr from-purple-700 via-indigo-600 to-blue-500 rounded-3xl shadow-2xl p-8 w-[420px] text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 18v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.9 4.9l2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.3 16.3l2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">Searching for duplicates</h3>
            <p className="text-sm opacity-90 mt-1">Scanning selected folder and subfolders — this may take a moment.</p>

            <div className="mt-4 bg-white/20 rounded-md p-3">
              <div className="flex justify-between text-xs opacity-90 mb-2">
                <span>Files scanned</span>
                <span>{scanned}</span>
              </div>
              <div className="w-full bg-white/10 rounded h-2 overflow-hidden mb-2">
                <div className="h-2 bg-white/60 rounded"
                  style={{ width: Math.min(100, Math.max(8, Math.log10(scanned + 10) * 10)) + '%' }} />
              </div>

              <div className="flex gap-3 text-xs">
                <div className="flex-1 bg-white/5 p-2 rounded">
                  <div className="text-2xl font-semibold">{duplicates}</div>
                  <div className="text-[10px] opacity-80">duplicate groups</div>
                </div>
                <div className="flex-1 bg-white/5 p-2 rounded">
                  <div className="text-2xl font-semibold">{candidates}</div>
                  <div className="text-[10px] opacity-80">hash candidates</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="bg-white/20 hover:bg-white/25 px-3 py-1.5 rounded text-sm" onClick={cancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
