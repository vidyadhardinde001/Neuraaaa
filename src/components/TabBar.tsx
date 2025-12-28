import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
  selectTabs,
  selectActiveTabId,
  addTab,
  closeTab,
  switchTab,
  renameTab,
} from "../state/slices/tabsSlice";

interface TabBarProps {
  onTabChange: (tabId: string) => void;
}

export function TabBar({ onTabChange }: TabBarProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const activeTabId = useAppSelector(selectActiveTabId);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState("");

  const handleAddTab = () => {
    dispatch(addTab({}));
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    dispatch(closeTab(tabId));
  };

  const handleSwitchTab = (tabId: string) => {
    dispatch(switchTab(tabId));
    onTabChange(tabId);
  };

  const handleRenameTab = (tabId: string, currentName: string) => {
    setRenamingTabId(tabId);
    setNewTabName(currentName);
  };

  const handleSaveRename = (tabId: string) => {
    if (newTabName.trim()) {
      dispatch(renameTab({ tabId, name: newTabName.trim() }));
    }
    setRenamingTabId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    const currentTab = tabs.find((t) => t.id === tabId);
    if (currentTab) {
      handleRenameTab(tabId, currentTab.name);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-gray-200 px-2 py-2 border-b border-gray-300 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => handleSwitchTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          className={`flex items-center gap-2 px-3 py-1 rounded-t-lg cursor-pointer transition ${
            activeTabId === tab.id
              ? "bg-white border-t-2 border-t-blue-500 shadow-sm"
              : "bg-gray-100 hover:bg-gray-150 text-gray-700"
          }`}
          style={{ minWidth: "120px" }}
        >
          {renamingTabId === tab.id ? (
            <input
              type="text"
              autoFocus
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onBlur={() => handleSaveRename(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveRename(tab.id);
                } else if (e.key === "Escape") {
                  setRenamingTabId(null);
                }
              }}
              className="flex-1 px-1 py-0 text-sm bg-white border border-blue-400 rounded outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate font-medium text-black min-w-[100px]">
              {tab.name.length > 15 ? `${tab.name.substring(0, 12)}...` : tab.name}
            </span>
          )}
          <button
            onClick={(e) => handleCloseTab(e, tab.id)}
            className="text-gray-500 hover:text-red-600 hover:bg-red-50 rounded p-0.5 flex items-center justify-center"
            title="Close tab"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={handleAddTab}
        className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
        title="New tab"
      >
        ➕
      </button>
    </div>
  );
}
