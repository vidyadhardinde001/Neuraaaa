import Input, { InputSize } from "../ui/Input";
import Button, { ButtonSize } from "../ui/Button";
import { useEffect, useState } from "react";

interface Props {
  title: string;
  submitName: string;
  onSubmit: (value: string) => unknown;
  shown: boolean;
  setShown: (shown: boolean) => unknown;
}

export default function InputModal({ shown, setShown, title, onSubmit, submitName }: Props) {
  const [inputValue, setInputValue] = useState("");

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInputValue("");
        setShown(false);
      }
    };
    if (shown) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [shown, setShown]);

  if (!shown) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={() => {
        setInputValue("");
        setShown(false);
      }}
    >
      <div
        className="bg-gray-100 dark:bg-gray-200 rounded-xl shadow-xl w-72 p-2 flex flex-col gap-4 transform transition-transform duration-200 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="modal-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-600 text-center"
        >
          {title}
        </h2>

        <Input
          value={inputValue}
          setValue={setInputValue}
          size={InputSize.Tiny}
          className="w-full text-center"
          autoFocus
          placeholder="Enter name..."
        />

        <div className="flex justify-center gap-3">
          <Button
            onClick={() => {
              setInputValue("");
              setShown(false);
            }}
            size={ButtonSize.Small}
            className="rounded-md bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </Button>

          <Button
            onClick={() => {
              if (inputValue.trim().length < 2) {
                alert("Input must be at least 2 characters long.");
                return;
              }
              onSubmit(inputValue.trim());
              setInputValue("");
              setShown(false);
            }}
            size={ButtonSize.Small}
            className=" rounded-md bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            {submitName}
          </Button>
        </div>
      </div>
    </div>
  );
}
