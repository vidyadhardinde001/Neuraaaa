/**
 * SearchBar Component
 *
 * Provides search functionality for files/folders within the current directory.
 * - Supports filters (by extension, file/dir).
 * - Calls Tauri backend command `search_directory` via invoke() OR listens to events.
 * - Updates parent state with results using setSearchResults.
 *
 * Communicates with:
 * - ../../ui/Input.tsx → Input component for search box.
 * - ./SearchFilter.tsx → Filter controls (file type, dirs, extensions).
 * - @tauri-apps/api/core → invoke() for backend search.
 * - @tauri-apps/api/event → listen() for streamed search results.
 * - Parent explorer component → Receives search results via setSearchResults.
 */

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { DirectoryContent } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import SearchFilter from "./SearchFilter";
import Input, { InputSize } from "../../ui/Input";

interface Props {
  currentVolume: string;
  currentDirectoryPath: string;
  setSearchResults: Dispatch<SetStateAction<DirectoryContent[]>>;
  onChangeDirectory?: (path: string) => void;
}

export interface ISearchFilter {
  extension: string;
  acceptFiles: boolean;
  acceptDirectories: boolean;
}

// Interface for backend streamed search results
interface ScoredChild {
  child: DirectoryContent;
  score: number;
}

export default function SearchBar({
  currentDirectoryPath,
  currentVolume,
  setSearchResults,
  onChangeDirectory,
}: Props) {
  const [searchValue, setSearchValue] = useState("");
  const [searchFilter, setSearchFilter] = useState<ISearchFilter>({
    extension: "",
    acceptFiles: true,
    acceptDirectories: true,
  });
  const [currentPlace, setCurrentPlace] = useState<string | undefined>();
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [results, setResults] = useState<ScoredChild[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [scannedCount, setScannedCount] = useState<number>(0);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [countsByExtension, setCountsByExtension] = useState<Record<string, number>>({});
  const [directoryInput, setDirectoryInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const split = currentDirectoryPath.split("\\");
    setCurrentPlace(split[split.length - 2]);
  }, [currentDirectoryPath]);

  async function onSearch() {
    if (!currentVolume) {
      alert("Please select a volume before searching.");
      return;
    }

    if (isSearching) {
      // Allow canceling search
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    // Reset previous stats for new search. elapsedTime will be set only when search finishes.
    setElapsedTime(0);
    setResults([]);
    setResultCount(0);
    setElapsedTime(0);
    setSearchResults([]);

    const unlistenResults = await listen<ScoredChild>("search_result", (event) => {
      setResults((prev) => {
        const newArr = [...prev];
        let i = 0;
        while (i < newArr.length && newArr[i].score >= event.payload.score) i++;
        newArr.splice(i, 0, event.payload);
        setResultCount(newArr.length);
        setSearchResults(newArr.map((r) => r.child));
        return newArr;
      });
    });

    const unlistenFinished = await listen<any>("search_finished", (event) => {
      const payload = event.payload as any;
      // payload is SearchFinished if backend sent stats, or a number for older behavior
      if (typeof payload === 'number') {
        setElapsedTime(payload);
      } else if (payload && typeof payload === 'object') {
        setElapsedTime(payload.elapsed_ms ?? 0);
        setScannedCount(payload.scanned ?? 0);
        setMatchedCount(payload.matched ?? 0);
        setCountsByType(payload.counts_by_type ?? {});
        setCountsByExtension(payload.counts_by_extension ?? {});
      }

      setIsSearching(false);
      unlistenResults();
      unlistenFinished();
    });

    // listen for progress updates
    const unlistenProgress = await listen<any>("search_progress", (event) => {
      const p = event.payload as any;
      setScannedCount(p.scanned ?? scannedCount);
      setMatchedCount(p.matched ?? matchedCount);
      setCountsByType(p.counts_by_type ?? countsByType);
      setCountsByExtension(p.counts_by_extension ?? countsByExtension);
    });

    try {
      await invoke("search_directory", {
        query: searchValue,
        searchDirectory: currentDirectoryPath,
        mountPnt: currentVolume,
        extension: searchFilter.extension,
        acceptFiles: searchFilter.acceptFiles,
        acceptDirectories: searchFilter.acceptDirectories,
      });
    } catch (error) {
      console.error("Search error:", error);
      setIsSearching(false);
      unlistenResults();
      unlistenFinished();
      unlistenProgress();
    }
  }

  function clearSearch() {
    setResults([]);
    setResultCount(0);
    setElapsedTime(0);
    setScannedCount(0);
    setMatchedCount(0);
    setCountsByType({});
    setCountsByExtension({});
    setSearchResults([]);
    setIsSearching(false);
    // Make sure search state and stats are cleaned up
  }

  function onGoToDirectory() {
    const p = directoryInput.trim();
    if (!p) return;
    if (onChangeDirectory) {
      onChangeDirectory(p);
    } else {
      alert("Directory navigation handler not provided");
    }
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            value={searchValue}
            setValue={setSearchValue}
            placeholder={`Search files and folders...`}
            className="w-full pl-10 pr-16 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            onSubmit={onSearch}
            size={InputSize.Large}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            disabled={!searchValue.trim()}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
              isSearching
                ? "bg-orange-500 text-white"
                : searchValue.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSearching ? (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Stop</span>
              </div>
            ) : (
              "Search"
            )}
          </button>

          <Input
            value={directoryInput}
            setValue={setDirectoryInput}
            placeholder="Enter directory path"
            className="w-64 pl-3 pr-3 py-2 border border-gray-300 rounded-lg"
            onSubmit={onGoToDirectory}
            size={InputSize.Tiny}
          />
          <button onClick={onGoToDirectory} className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Go</button>
        </div>
      </div>

      {/* Small floating stats window (right side) — visible only when a volume is selected */}
      {currentVolume && currentVolume !== "" && (
        <div className="fixed m-3 mt-3 right-0 top-[200px] w-[400px] p-2 bg-white border border-gray-200 rounded shadow-md text-xs z-40">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold text-gray-700">Search</div>
            <div className={`text-xs ${isSearching ? 'text-orange-500' : 'text-gray-400'}`}>
              {isSearching ? 'running' : 'last'}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="text-[11px] text-gray-500">Query time</div>
            <div className="text-blue-400 font-medium text-sm">{elapsedTime > 0 ? (elapsedTime/1000).toFixed(2) + 's' : '—'}</div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="text-[11px] text-gray-500">Files scanned</div>
            <div className="text-blue-400 font-medium text-sm">{scannedCount}</div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="text-[11px] text-gray-500">Matches</div>
            <div className=" text-blue-400 font-medium text-sm">{matchedCount}</div>
          </div>

          {/* small breakdown by type (file / directory) — keep it compact */}
          {Object.keys(countsByType).length > 0 && (
            <div className="mt-2 text-[11px] text-gray-500 border-t pt-2">
              <div className="font-medium text-[11px] text-gray-700 mb-1">By type</div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(countsByType).map(([t, c]) => (
                  <div key={t} className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-700">
                    {t}: {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {/* <div className="max-h-80 overflow-y-auto">
        {results.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isSearching ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Searching files...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">Enter a search term to find files</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    (item.child as any).type === 'file' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {(item.child as any).type === 'file' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{(item.child as any).name}</p>
                    <p className="text-xs text-gray-500 truncate">{(item.child as any).path}</p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    item.score >= 800 
                      ? 'bg-green-100 text-green-800' 
                      : item.score >= 500 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div> */}
    </div>
  );
}