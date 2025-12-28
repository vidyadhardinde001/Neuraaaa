import { useState, useEffect } from "react";
import { DirectoryContent } from "../types";

export default function useNavigation(
  searchResults: DirectoryContent[],
  setSearchResults: Function,
  tabPathHistory: string[] = [""],
  tabHistoryPlace: number = 0
) {
  const [pathHistory, setPathHistory] = useState(tabPathHistory);
  const [historyPlace, setHistoryPlace] = useState(tabHistoryPlace);
  const [currentVolume, setCurrentVolume] = useState("");

  // Sync with tab changes - when activeTab changes in parent, these props change
  useEffect(() => {
    setPathHistory(tabPathHistory);
    setHistoryPlace(tabHistoryPlace);
  }, [tabPathHistory, tabHistoryPlace]);

  function onBackArrowClick() {
    if (searchResults.length > 0) {
      setHistoryPlace(historyPlace);
      setSearchResults([]);
      return;
    }

    const newPlace = historyPlace - 1;
    setHistoryPlace(newPlace);
  }

  function onForwardArrowClick() {
    const newPlace = historyPlace + 1;
    setHistoryPlace(newPlace);
  }

  function canGoForward(): boolean {
    return historyPlace < pathHistory.length - 1;
  }
  
  function canGoBackward(): boolean {
    return historyPlace > 0;
  }

  return {
    pathHistory,
    setPathHistory,
    historyPlace,
    setHistoryPlace,
    onBackArrowClick,
    onForwardArrowClick,
    canGoForward,
    canGoBackward,
    currentVolume,
    setCurrentVolume,
  };
}
