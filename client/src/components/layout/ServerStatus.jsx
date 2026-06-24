import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function ServerStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let intervalId;

    const checkStatus = async () => {
      try {
        let apiBase = import.meta.env.VITE_API_URL || '';
        if (apiBase.endsWith('/')) {
          apiBase = apiBase.slice(0, -1);
        }
        
        // Short timeout for health check so it fails fast if offline
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(`${apiBase}/api/health`, { 
          signal: controller.signal,
          credentials: 'omit'
        });
        clearTimeout(timeoutId);
        
        if (isMounted) {
          if (res.ok) {
            setIsConnected(true);
          } else {
            setIsConnected(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsConnected(false);
        }
      }
    };

    checkStatus();

    // Check status at interval based on current connection state
    const intervalTime = isConnected ? 30000 : 5000;
    intervalId = setInterval(checkStatus, intervalTime);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isConnected]);

  return (
    <div className="relative group flex items-center justify-center cursor-pointer select-none">
      <div className="w-9 h-9 rounded-xl bg-surface-hover/60 hover:bg-surface-hover flex items-center justify-center border border-border-dark hover:border-accent-teal/20 transition-all duration-300">
        <Shield 
          className={`w-4.5 h-4.5 transition-colors duration-300 ${
            isConnected ? 'text-accent-teal' : 'text-text-secondary/50'
          }`} 
        />
        
        {/* Signal Indicator Dot */}
        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
          {isConnected ? (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-md shadow-emerald-500/50"></span>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-md shadow-red-500/50"></span>
            </>
          )}
        </span>
      </div>

      {/* Floating Tooltip */}
      <div className="absolute right-0 top-11 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
        <div className="bg-surface-dark border border-border-dark text-text-primary px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xl shadow-black/80 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
          }`} />
          {isConnected ? 'Server connected' : 'Connecting to server'}
        </div>
      </div>
    </div>
  );
}
