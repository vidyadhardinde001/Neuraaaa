/**
 * VaultTrigger Component
 *
 * Invisible component that listens for hidden vault activation triggers:
 * - Secret keyword in search bar
 * - Multi-key chord (e.g., Ctrl+Alt+V pressed 3 times)
 * - Three-click on logo/app title
 *
 * When triggered, opens the VaultModal for authentication.
 */

import { useEffect, useState, useRef } from "react";

interface VaultTriggerProps {
  onTrigger: () => void;
}

export default function VaultTrigger({ onTrigger }: VaultTriggerProps) {
  const [keySequence, setKeySequence] = useState<string[]>([]);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const SECRET_KEYWORD = "VAULT_ACCESS"; // Can be customized in settings
  const SECRET_CHORD = "ControlAltV"; // Ctrl+Alt+V

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track for multi-key chord
      const keyCode = `${e.ctrlKey ? "Control" : ""}${e.altKey ? "Alt" : ""}${e.key}`;

      // Check for secret chord (Ctrl+Alt+V)
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "v") {
        setKeySequence((prev) => {
          const newSeq = [...prev, SECRET_CHORD];
          // Reset if sequence is too old (older than 5 seconds)
          if (newSeq.length > 1) {
            setTimeout(
              () => {
                setKeySequence([]);
              },
              5000
            );
          }
          // Trigger after 3 presses
          if (newSeq.length >= 3) {
            console.log("Vault trigger activated via chord!");
            onTrigger();
            return [];
          }
          return newSeq;
        });
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTrigger]);

  // Three-click trigger (on app title or logo)
  const handleTripleClick = () => {
    clickCountRef.current++;
    clearTimeout(clickTimerRef.current);

    if (clickCountRef.current === 3) {
      console.log("Vault trigger activated via triple-click!");
      onTrigger();
      clickCountRef.current = 0;
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 500); // Reset if 3 clicks don't happen within 500ms
    }
  };

  // Invisible component - only provides event listeners
  return (
    <div
      className="absolute -top-96 -left-96 w-0 h-0 pointer-events-none select-none"
      onDoubleClick={handleTripleClick}
      title="Vault trigger element (invisible)"
    />
  );
}
