/**
 * FolderNavigation Component
 *
 * Provides back, forward, and refresh buttons for folder navigation.
 *
 * Communicates with:
 * - Parent explorer component → Provides navigation functions and state:
 *   - onBackArrowClick
 *   - onForwardArrowClick
 *   - onRefresh
 *
 * If modified, also check:
 * - Parent component (navigation history + refresh logic lives there)
 */



import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import SettingsModal from "../SettingsModal";

export interface Props {
    onBackArrowClick: () => void;
    canGoBackward: boolean;
    onForwardArrowClick: () => void;
    canGoForward: boolean;
    onRefresh: () => Promise<void>;
}

export default function FolderNavigation({ onBackArrowClick, canGoBackward, onForwardArrowClick, canGoForward, onRefresh }: Props) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };

    return (
        <div className="flex justify-start items-center mb-5 w-full">
            <div className="flex space-x-2">
                {/* Back button */}
                <button
                    onClick={onBackArrowClick}
                    disabled={!canGoBackward}
                    className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon icon={faArrowLeft} size="sm" />
                </button>

                {/* Forward button */}
                <button
                    onClick={onForwardArrowClick}
                    disabled={!canGoForward}
                    className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon icon={faArrowRight} size="sm" />
                </button>

                {/* Refresh button */}
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon 
                        icon={faSyncAlt} 
                        size="sm" 
                        className={isRefreshing ? "animate-spin" : ""} 
                    />
                </button>

                {/* Settings button */}
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                    ⚙
                </button>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
}