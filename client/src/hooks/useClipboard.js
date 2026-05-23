import { useState, useEffect, useRef } from 'react';

export const useClipboard = (timeout = 30000) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(null);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      
      // Clear previous timeout if any
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set timeout to clear clipboard and reset state
      timeoutRef.current = setTimeout(async () => {
        try {
          // Clear clipboard securely by writing empty string
          // Only clear if the current clipboard text still matches the copied text (some browsers allow checking, but simple overwrite is safer)
          await navigator.clipboard.writeText('');
        } catch (err) {
          console.warn('Failed to clear clipboard:', err);
        }
        setIsCopied(false);
      }, timeout);
      
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copy, isCopied };
};
