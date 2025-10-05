import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact" | "spacious";
export type ViewMode = "list" | "grid";
export type SizeFormat = "binary" | "decimal";

export interface ColumnsSettings {
  showSize: boolean;
  showDate: boolean;
}

export interface SettingsState {
  theme: Theme;
  density: Density;
  showPreview: boolean;
  viewMode: ViewMode;
  showHiddenFiles: boolean;
  sizeFormat: SizeFormat;
  defaultSort: string;
  sortDirection: "asc" | "desc";
  columns: ColumnsSettings;
  accentColor: string; // hex
  animationsEnabled: boolean;
  invertText: boolean;
}

const STORAGE_KEY = "neura_settings_v2";

function loadInitial(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SettingsState;
  } catch (e) {
    // ignore
  }

  return {
    theme: "light",
    density: "comfortable",
    showPreview: true,
    viewMode: "list",
    showHiddenFiles: false,
    sizeFormat: "binary",
    defaultSort: "name",
    sortDirection: "asc",
    columns: { showSize: true, showDate: true },
    accentColor: "#2563eb",
    animationsEnabled: true,
    invertText: false,
  };
}

function persist(state: SettingsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
}

const initialState: SettingsState = loadInitial();

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      persist(state);
    },
    setDensity(state, action: PayloadAction<Density>) {
      state.density = action.payload;
      persist(state);
    },
    setShowPreview(state, action: PayloadAction<boolean>) {
      state.showPreview = action.payload;
      persist(state);
    },
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload;
      persist(state);
    },
    setShowHiddenFiles(state, action: PayloadAction<boolean>) {
      state.showHiddenFiles = action.payload;
      persist(state);
    },
    setSizeFormat(state, action: PayloadAction<SizeFormat>) {
      state.sizeFormat = action.payload;
      persist(state);
    },
    setDefaultSort(state, action: PayloadAction<string>) {
      state.defaultSort = action.payload;
      persist(state);
    },
    setSortDirection(state, action: PayloadAction<"asc" | "desc">) {
      state.sortDirection = action.payload;
      persist(state);
    },
    setColumns(state, action: PayloadAction<ColumnsSettings>) {
      state.columns = action.payload;
      persist(state);
    },
    setAccentColor(state, action: PayloadAction<string>) {
      state.accentColor = action.payload;
      persist(state);
    },
    setInvertText(state, action: PayloadAction<boolean>) {
      state.invertText = action.payload;
      persist(state);
    },
    setAnimationsEnabled(state, action: PayloadAction<boolean>) {
      state.animationsEnabled = action.payload;
      persist(state);
    },
    resetSettings(state) {
      const def = loadInitial();
      Object.assign(state, def);
      persist(state);
    }
  }
});

export const {
  setTheme,
  setDensity,
  setShowPreview,
  setViewMode,
  setShowHiddenFiles,
  setSizeFormat,
  setDefaultSort,
  setSortDirection,
  setColumns,
  setAccentColor,
  setAnimationsEnabled,
  setInvertText,
  resetSettings,
} = settingsSlice.actions;

export const selectSettings = (state: any) => state.settings as SettingsState;

export default settingsSlice.reducer;
