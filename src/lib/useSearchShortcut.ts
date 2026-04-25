import { useEffect, RefObject } from 'react';

/**
 * Keyboard shortcuts for search inputs:
 *  `/`      — focus the search input (when not already in an input)
 *  `Escape` — clear search and blur the input (when input is focused)
 */
export function useSearchShortcut(
  inputRef: RefObject<HTMLInputElement | null>,
  onClear: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (e.key === '/' && !inInput) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onClear();
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef, onClear]);
}
