import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

export interface Tab {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  historyPlace: number;
  pathHistory: string[];
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string;
  nextTabId: number;
}

const initialState: TabsState = {
  tabs: [
    {
      id: "tab-0",
      name: "New Tab",
      path: "",
      isActive: true,
      historyPlace: 0,
      pathHistory: [""],
    },
  ],
  activeTabId: "tab-0",
  nextTabId: 1,
};

const tabsSlice = createSlice({
  name: "tabs",
  initialState,
  reducers: {
    // Add new tab
    addTab: (state, action: PayloadAction<{ path?: string; name?: string }>) => {
      const newTab: Tab = {
        id: `tab-${state.nextTabId}`,
        name: action.payload.name || `Tab ${state.nextTabId + 1}`,
        path: action.payload.path || "",
        isActive: true,
        historyPlace: 0,
        pathHistory: [action.payload.path || ""],
      };

      // Mark all other tabs as inactive
      state.tabs.forEach((tab) => (tab.isActive = false));

      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
      state.nextTabId += 1;
    },

    // Close tab by ID
    closeTab: (state, action: PayloadAction<string>) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === action.payload);
      if (tabIndex === -1) return;

      state.tabs.splice(tabIndex, 1);

      // If closed tab was active, switch to another
      if (state.activeTabId === action.payload) {
        if (state.tabs.length > 0) {
          const nextTab = state.tabs[Math.max(0, tabIndex - 1)];
          state.activeTabId = nextTab.id;
          nextTab.isActive = true;
        } else {
          // Create default tab if all tabs are closed
          const defaultTab: Tab = {
            id: `tab-${state.nextTabId}`,
            name: "New Tab",
            path: "",
            isActive: true,
            historyPlace: 0,
            pathHistory: [""],
          };
          state.tabs.push(defaultTab);
          state.activeTabId = defaultTab.id;
          state.nextTabId += 1;
        }
      }
    },

    // Switch active tab
    switchTab: (state, action: PayloadAction<string>) => {
      state.tabs.forEach((tab) => {
        tab.isActive = tab.id === action.payload;
      });
      state.activeTabId = action.payload;
    },

    // Update tab path and history
    updateTabPath: (
      state,
      action: PayloadAction<{
        tabId: string;
        path: string;
        pathHistory: string[];
        historyPlace: number;
      }>
    ) => {
      const tab = state.tabs.find((t) => t.id === action.payload.tabId);
      if (tab) {
        tab.path = action.payload.path;
        tab.pathHistory = action.payload.pathHistory;
        tab.historyPlace = action.payload.historyPlace;
        tab.name = action.payload.path.split(/[\\/]/).pop() || "Home";
      }
    },

    // Rename tab
    renameTab: (state, action: PayloadAction<{ tabId: string; name: string }>) => {
      const tab = state.tabs.find((t) => t.id === action.payload.tabId);
      if (tab) {
        tab.name = action.payload.name;
      }
    },

    // Close all tabs
    closeAllTabs: (state) => {
      const defaultTab: Tab = {
        id: `tab-${state.nextTabId}`,
        name: "New Tab",
        path: "",
        isActive: true,
        historyPlace: 0,
        pathHistory: [""],
      };
      state.tabs = [defaultTab];
      state.activeTabId = defaultTab.id;
      state.nextTabId += 1;
    },
  },
});

export const {
  addTab,
  closeTab,
  switchTab,
  updateTabPath,
  renameTab,
  closeAllTabs,
} = tabsSlice.actions;

export const selectTabs = (state: RootState) => state.tabs.tabs;
export const selectActiveTab = (state: RootState) =>
  state.tabs.tabs.find((t) => t.id === state.tabs.activeTabId);
export const selectActiveTabId = (state: RootState) => state.tabs.activeTabId;

export default tabsSlice.reducer;
