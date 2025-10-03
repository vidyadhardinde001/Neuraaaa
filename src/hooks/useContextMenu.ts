/**
 * useContextMenu Hook
 * ---------------------
 * Custom React hook to manage right-click (context menu) behavior.
 *
 * Provides:
 *  - handleMainContextMenu: Opens a General Context Menu at mouse position unless user clicked a directory entity.
 *  - handleCloseContextMenu: Closes the context menu when clicking outside.
 *
 * Communicates with:
 *  - ../state/slices/contextMenuSlice.ts (dispatches open/close actions).
 *  - ../state/constants/constants.ts (uses NO_CONTEXT_MENU for reset).
 *  - ../components/MainBody/DirectoryEntity.tsx (skips if right-clicked on entity).
 *  - ContextMenu.tsx (renders menus based on Redux state updates).
 */

import {MouseEvent} from "react";
import {updateContextMenu} from "../state/slices/contextMenuSlice";
import {ContextMenuType} from "../types";
import {NO_CONTEXT_MENU} from "../state/constants/constants";
import {AppDispatch} from "../state/store";
import {DIRECTORY_ENTITY_ID} from "../components/MainBody/DirectoryEntity";

export default function useContextMenu(dispatch: AppDispatch, currentPath: string) {
    function handleMainContextMenu(e: MouseEvent<HTMLDivElement>)  {
        e.preventDefault();

        if (e.target instanceof HTMLElement) {
            if (e.target.id === DIRECTORY_ENTITY_ID) return;
        }

        dispatch(updateContextMenu({
            currentContextMenu: ContextMenuType.General,
            mouseX: e.pageX,
            mouseY: e.pageY,
            contextMenuPayload: { currentPath }
        }));
    }

    function handleCloseContextMenu(e: MouseEvent<HTMLDivElement>) {
        if (e.target instanceof HTMLElement) {
            if (document.getElementById("context-menu")?.contains(e.target)) return;
        }

        dispatch(updateContextMenu(NO_CONTEXT_MENU));
    }

    return [handleMainContextMenu, handleCloseContextMenu];
}