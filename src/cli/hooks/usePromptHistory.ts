import { useCallback, useEffect, useRef } from "react";

interface UsePromptHistoryOptions {
  entries: readonly string[];
  input: string;
  setInput: (value: string) => void;
}

export function usePromptHistory({ entries, input, setInput }: UsePromptHistoryOptions) {
  const indexRef = useRef(0);
  const draftRef = useRef("");
  const applyingHistoryRef = useRef(false);

  useEffect(() => {
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      return;
    }

    if (indexRef.current !== 0) {
      indexRef.current = 0;
      draftRef.current = input;
      return;
    }

    draftRef.current = input;
  }, [input]);

  const applyInput = useCallback((value: string) => {
    applyingHistoryRef.current = true;
    setInput(value);
  }, [setInput]);

  const navigateUp = useCallback((): boolean => {
    if (entries.length === 0 || indexRef.current >= entries.length) {
      return false;
    }

    if (indexRef.current === 0) {
      draftRef.current = input;
    }

    indexRef.current += 1;
    applyInput(entries[indexRef.current - 1] ?? "");
    return true;
  }, [applyInput, entries, input]);

  const navigateDown = useCallback((): boolean => {
    if (indexRef.current === 0) {
      return false;
    }

    indexRef.current -= 1;
    if (indexRef.current === 0) {
      applyInput(draftRef.current);
      return true;
    }

    applyInput(entries[indexRef.current - 1] ?? "");
    return true;
  }, [applyInput, entries]);

  const reset = useCallback(() => {
    indexRef.current = 0;
    draftRef.current = "";
    applyingHistoryRef.current = false;
  }, []);

  return {
    navigateUp,
    navigateDown,
    reset,
  };
}
