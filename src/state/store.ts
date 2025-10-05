import { configureStore } from "@reduxjs/toolkit";
import contextMenu from "./slices/contextMenuSlice";
import currentDirectory from "./slices/currentDirectorySlice";
import settings from "./slices/settingsSlice";

export const store = configureStore({
    reducer: {
        contextMenu,
        currentDirectory,
        settings,
    }
})

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
