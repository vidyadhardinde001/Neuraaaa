/**
 * ContextMenu Component
 *
 * Renders a right-click context menu with given options.
 * - Handles positioning so it doesn’t go off-screen.
 * - Closes on outside click or after selecting an option.
 *
 * Dependencies (communicates with):
 * - ../../state/hooks → Redux hooks (dispatch/select)
 * - ../../state/slices/contextMenuSlice → updateContextMenu action
 * - ../../state/constants/constants → NO_CONTEXT_MENU
 *
 * If modified, also check:
 * - contextMenuSlice.ts (Redux logic for context menu state)
 * - constants.ts (if you change menu states)
 */



import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { updateContextMenu } from "../../state/slices/contextMenuSlice";
import { NO_CONTEXT_MENU } from "../../state/constants/constants";
import { useEffect, useRef } from "react";

interface ContextMenuOption {
    name: string;
    onClick: Function;
    icon?: React.ReactNode;
    destructive?: boolean;
    disabled?: boolean;
}

interface Props {
    options: ContextMenuOption[];
}

export default function ContextMenu({ options }: Props) {
    const dispatch = useAppDispatch();
    const { mouseX, mouseY } = useAppSelector(state => state.contextMenu);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                dispatch(updateContextMenu(NO_CONTEXT_MENU));
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dispatch]);

    // Prevent context menu from going off-screen
    const getAdjustedPosition = () => {
        if (!menuRef.current) return { left: mouseX, top: mouseY };
        
        const menuWidth = 192; // w-48 = 192px
        const menuHeight = options.length * 40; // Approximate height per item
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = mouseX;
        let top = mouseY;
        
        // Adjust horizontal position if menu would go off-screen
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 10;
        }
        
        // Adjust vertical position if menu would go off-screen
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10;
        }
        
        return { left: Math.max(10, left), top: Math.max(10, top) };
    };

    const position = getAdjustedPosition();

    return (
        <div
            ref={menuRef}
            id="context-menu"
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 w-48 py-1 z-50 overflow-hidden animate-in fade-in-90 zoom-in-95"
            style={{
                left: position.left,
                top: position.top,
            }}
        >
            {options.map((option, idx) => (
                <button
                    key={idx}
                    onClick={() => {
                        if (!option.disabled) {
                            option.onClick();
                            dispatch(updateContextMenu(NO_CONTEXT_MENU));
                        }
                    }}
                    disabled={option.disabled}
                    className={`
                        w-full px-4 py-2 text-left text-sm flex items-center space-x-3
                        transition-colors duration-150 ease-in-out
                        ${option.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : option.destructive
                                ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
                                : 'text-gray-700 hover:bg-gray-100 focus:bg-gray-100'
                        }
                        focus:outline-none
                    `}
                >
                    {option.icon && (
                        <span className="w-4 h-4 flex-shrink-0">
                            {option.icon}
                        </span>
                    )}
                    <span className="flex-1">{option.name}</span>
                </button>
            ))}
        </div>
    );
}