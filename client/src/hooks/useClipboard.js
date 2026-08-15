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
          // Do not destroy clipboard content the user copied after the password.
          const currentText = await navigator.clipboard.readText();
          if (currentText === text) {
            await navigator.clipboard.writeText('');
          }
        } catch (err) {
          // Reading can be denied after the popup loses focus. In that case,
          // leave the clipboard unchanged instead of potentially overwriting it.
          console.warn('Unable to safely clear clipboard:', err);
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
