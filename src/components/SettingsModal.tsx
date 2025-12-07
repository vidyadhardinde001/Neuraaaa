import React, { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
  selectSettings,
  setTheme,
  setDensity,
  setShowPreview,
  setViewMode,
  setShowHiddenFiles,
  setSizeFormat,
  setColumns,
  setAccentColor,
  setAnimationsEnabled,
  setInvertText,
} from "../state/slices/settingsSlice";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const settings = useAppSelector(selectSettings);
  const dispatch = useAppDispatch();

  // Close on ESC
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed top-[400px] inset-0 z-50 flex items-center justify-center text-gray-700">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-xl rounded-lg shadow-lg p-4 bg-gray-200 mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-3 border-b border-gray-300 pb-2">
          <h3 id="settings-title" className="text-lg font-semibold">
            Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400/60 scrollbar-track-transparent pr-1">
          {/* Appearance */}
          <section>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">
              Appearance
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    dispatch(setTheme(e.target.value as typeof settings.theme))
                  }
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Density
                </label>
                <select
                  value={settings.density}
                  onChange={(e) =>
                    dispatch(
                      setDensity(e.target.value as typeof settings.density)
                    )
                  }
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Accent Color
                </label>
                <input
                  type="text"
                  value={settings.accentColor}
                  onChange={(e) => dispatch(setAccentColor(e.target.value))}
                  className="w-full border rounded px-2 py-1 bg-white"
                  placeholder="#3b82f6 or any CSS color"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Invert Text Color</div>
                  <div className="text-xs text-gray-500">
                    Automatically adjust text color for better contrast
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.invertText}
                  onChange={(e) =>
                    dispatch(setInvertText(e.target.checked))
                  }
                />
              </div>
            </div>
          </section>

          {/* Layout */}
          <section>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">
              Layout
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  View Mode
                </label>
                <select
                  value={settings.viewMode}
                  onChange={(e) =>
                    dispatch(
                      setViewMode(e.target.value as typeof settings.viewMode)
                    )
                  }
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="list">List</option>
                  <option value="grid">Grid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Size Format
                </label>
                <select
                  value={settings.sizeFormat}
                  onChange={(e) =>
                    dispatch(
                      setSizeFormat(
                        e.target.value as typeof settings.sizeFormat
                      )
                    )
                  }
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="binary">Binary (KiB, MiB)</option>
                  <option value="decimal">Decimal (KB, MB)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Columns */}
          <section>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">
              Columns
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Size</span>
                <input
                  type="checkbox"
                  checked={settings.columns.showSize}
                  onChange={(e) =>
                    dispatch(
                      setColumns({
                        ...settings.columns,
                        showSize: e.target.checked,
                      })
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Date</span>
                <input
                  type="checkbox"
                  checked={settings.columns.showDate}
                  onChange={(e) =>
                    dispatch(
                      setColumns({
                        ...settings.columns,
                        showDate: e.target.checked,
                      })
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* Behavior */}
          <section>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">
              Behavior
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Show Hidden Files</div>
                  <div className="text-xs text-gray-500">
                    Toggle display of dotfiles and hidden entries
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showHiddenFiles}
                  onChange={(e) =>
                    dispatch(setShowHiddenFiles(e.target.checked))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Floating Preview</div>
                  <div className="text-xs text-gray-500">
                    Show small floating file preview when selecting a file
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showPreview}
                  onChange={(e) =>
                    dispatch(setShowPreview(e.target.checked))
                  }
                />
              </div>
            </div>
          </section>

          {/* Performance / animations */}
          <section>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">
              Performance & Effects
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Animations</div>
                <div className="text-xs text-gray-500">
                  Enable or disable UI animations for smoother or snappier feel
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.animationsEnabled}
                onChange={(e) =>
                  dispatch(setAnimationsEnabled(e.target.checked))
                }
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end border-t border-gray-300 pt-3">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-300 text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
