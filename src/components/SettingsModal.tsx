import React from "react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center text-gray-600">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative rounded-lg shadow-lg w-[40%] p-4 bg-gray-200">
        <div className="flex justify-between items-center mb-3 ">
          <h3 className="text-lg font-medium">Settings</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-none">
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => dispatch(setTheme(e.target.value as any))}
              className="w-full border rounded px-2 py-1"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Density</label>
            <select
              value={settings.density}
              onChange={(e) => dispatch(setDensity(e.target.value as any))}
              className="w-full border rounded px-2 py-1"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">View Mode</label>
            <select value={settings.viewMode} onChange={(e) => dispatch(setViewMode(e.target.value as any))} className="w-full border rounded px-2 py-1">
              <option value="list">List</option>
              <option value="grid">Grid</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Show Hidden Files</div>
              <div className="text-xs text-gray-500">Toggle display of dotfiles and hidden entries</div>
            </div>
            <input type="checkbox" checked={settings.showHiddenFiles} onChange={(e) => dispatch(setShowHiddenFiles(e.target.checked))} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Size Format</label>
            <select value={settings.sizeFormat} onChange={(e) => dispatch(setSizeFormat(e.target.value as any))} className="w-full border rounded px-2 py-1">
              <option value="binary">Binary (KiB, MiB)</option>
              <option value="decimal">Decimal (KB, MB)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Columns</label>
            <div className="flex items-center justify-between">
              <div className="text-sm">Size</div>
              <input type="checkbox" checked={settings.columns.showSize} onChange={(e) => dispatch(setColumns({ ...settings.columns, showSize: e.target.checked }))} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm">Date</div>
              <input type="checkbox" checked={settings.columns.showDate} onChange={(e) => dispatch(setColumns({ ...settings.columns, showDate: e.target.checked }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Accent Color</label>
            <input value={settings.accentColor} onChange={(e) => dispatch(setAccentColor(e.target.value))} className="w-full border rounded px-2 py-1" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Animations</div>
              <div className="text-xs text-gray-500">Enable/disable UI animations</div>
            </div>
            <input type="checkbox" checked={settings.animationsEnabled} onChange={(e) => dispatch(setAnimationsEnabled(e.target.checked))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Floating Preview</div>
              <div className="text-xs text-gray-500">Show small floating file preview when selecting a file</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showPreview}
              onChange={(e) => dispatch(setShowPreview(e.target.checked))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Invert Text Color</div>
              <div className="text-xs text-gray-500">Make text color automatically contrast with background</div>
            </div>
            <input type="checkbox" checked={settings.invertText} onChange={(e) => dispatch(setInvertText(e.target.checked))} />
          </div>

          <div className="flex justify-end">
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-100">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
