import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, RefreshCw, Info, Lock } from 'lucide-react';
import { useClipboard } from '../../hooks/useClipboard';

export default function PasswordGenerator() {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(24);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [passwordHistory, setPasswordHistory] = useState([]);
  
  const { copy, isCopied } = useClipboard(15000);

  const generate = () => {
    let charset = '';
    let reqChars = []; // Ensure at least one character of each selected type is included
    
    let uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lowers = 'abcdefghijklmnopqrstuvwxyz';
    let nums = '0123456789';
    let syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeSimilar) {
      uppers = uppers.replace(/[OIL]/g, '');
      lowers = lowers.replace(/[oil]/g, '');
      nums = nums.replace(/[01]/g, '');
      syms = syms.replace(/[|]/g, '');
    }

    if (uppercase) {
      charset += uppers;
      reqChars.push(uppers[Math.floor(Math.random() * uppers.length)]);
    }
    if (lowercase) {
      charset += lowers;
      reqChars.push(lowers[Math.floor(Math.random() * lowers.length)]);
    }
    if (numbers) {
      charset += nums;
      reqChars.push(nums[Math.floor(Math.random() * nums.length)]);
    }
    if (symbols) {
      charset += syms;
      reqChars.push(syms[Math.floor(Math.random() * syms.length)]);
    }

    if (!charset) {
      setPassword('Select at least one option.');
      return;
    }

    let result = [];
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    // Fill with random characters
    for (let i = 0; i < length; i++) {
      result.push(charset[randomValues[i] % charset.length]);
    }

    // Overwrite first few characters with required characters to guarantee coverage
    for (let i = 0; i < Math.min(reqChars.length, length); i++) {
      result[i] = reqChars[i];
    }

    // Shuffle the result array to make it random
    const shuffleArray = new Uint32Array(length);
    window.crypto.getRandomValues(shuffleArray);
    for (let i = length - 1; i > 0; i--) {
      const j = shuffleArray[i] % (i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }

    const newPassword = result.join('');
    setPassword(newPassword);
    
    // Add to history (max 5 items, keep it secure in component memory)
    setPasswordHistory(prev => [newPassword, ...prev.slice(0, 4)]);
  };

  // Generate on mount
  useEffect(() => {
    generate();
  }, [length, uppercase, lowercase, numbers, symbols, excludeSimilar]);

  // Calculate password strength and entropy
  const getStrength = () => {
    if (!password || password.startsWith('Select')) return { label: 'None', color: 'bg-border-dark', pct: 0, text: 'text-text-secondary' };
    
    let poolSize = 0;
    if (uppercase) poolSize += excludeSimilar ? 23 : 26;
    if (lowercase) poolSize += excludeSimilar ? 23 : 26;
    if (numbers) poolSize += excludeSimilar ? 8 : 10;
    if (symbols) poolSize += excludeSimilar ? 25 : 26;

    if (poolSize === 0) return { label: 'None', color: 'bg-border-dark', pct: 0, text: 'text-text-secondary' };

    const entropy = Math.round(length * Math.log2(poolSize));
    
    if (entropy < 40) return { label: 'Weak (Unsafe)', color: 'bg-red-500', pct: 25, text: 'text-red-400', entropy };
    if (entropy < 60) return { label: 'Fair (Not recommended)', color: 'bg-amber-500', pct: 50, text: 'text-amber-400', entropy };
    if (entropy < 80) return { label: 'Strong (Secure)', color: 'bg-emerald-500', pct: 75, text: 'text-emerald-400', entropy };
    return { label: 'Excellent (Very Secure)', color: 'bg-cyan-500 shadow-lg shadow-cyan-500/20', pct: 100, text: 'text-accent-teal', entropy };
  };

  const strength = getStrength();

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Password Generator</h2>
        <p className="text-xs text-text-secondary mt-1">
          Generate highly secure, cryptographically random keys and passwords client-side.
        </p>
      </div>

      {/* Main Password Output Card */}
      <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4 shadow-xl">
        <div className="flex gap-3">
          <div className="flex-1 px-4 py-3.5 rounded-xl bg-bg-dark border border-border-dark font-mono text-base md:text-lg text-text-primary tracking-wider break-all select-all flex items-center justify-between min-h-[56px]">
            {password}
          </div>
          <button
            onClick={() => copy(password)}
            disabled={!password || password.startsWith('Select')}
            className={`px-4 py-3 rounded-xl border transition-all active:scale-[0.97] flex items-center justify-center shrink-0 cursor-pointer ${
              isCopied 
                ? 'bg-accent-glow border-accent-teal/30 text-accent-teal font-medium'
                : 'bg-bg-dark border-border-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            {isCopied ? (
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Copied!
              </span>
            ) : (
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Copy className="w-4 h-4" />
                Copy
              </span>
            )}
          </button>
          <button
            onClick={generate}
            title="Regenerate"
            className="p-3.5 rounded-xl border border-border-dark bg-bg-dark text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all active:rotate-90 shrink-0"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Strength Meter Bar */}
        {strength.entropy && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary font-medium">Password Strength:</span>
              <span className={`font-bold ${strength.text}`}>{strength.label}</span>
            </div>
            
            <div className="h-2 w-full bg-bg-dark border border-border-dark rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ease-out ${strength.color}`} 
                style={{ width: `${strength.pct}%` }} 
              />
            </div>
            
            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary/60">
              <Info className="w-3.5 h-3.5" />
              <span>Entropy: <span className="font-mono text-text-secondary">{strength.entropy} bits</span>. Values above 60 bits are generally safe.</span>
            </div>
          </div>
        )}
      </div>

      {/* Options Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Settings Card */}
        <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary/70">Generator Options</h3>
          
          {/* Length Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Password Length:</span>
              <span className="font-mono font-bold text-text-primary">{length} characters</span>
            </div>
            <input
              type="range"
              min={8}
              max={128}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full h-1.5 bg-bg-dark rounded-lg appearance-none cursor-pointer accent-accent-teal border border-border-dark"
            />
            <div className="flex justify-between text-[10px] text-text-secondary/50 font-mono">
              <span>8</span>
              <span>32</span>
              <span>64</span>
              <span>96</span>
              <span>128</span>
            </div>
          </div>

          {/* Similar Characters Toggle */}
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-bg-dark/50 border border-border-dark/60 text-xs text-text-primary hover:text-text-primary cursor-pointer hover:bg-bg-dark transition-colors">
            <div className="space-y-0.5">
              <span className="font-semibold">Avoid Ambiguous Characters</span>
              <p className="text-[10px] text-text-secondary/60">Exclude similar looking characters like O, 0, I, l, 1</p>
            </div>
            <input
              type="checkbox"
              checked={excludeSimilar}
              onChange={(e) => setExcludeSimilar(e.target.checked)}
              className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>

        {/* Character Checklist Card */}
        <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary/70">Character Requirements</h3>
          
          <div className="space-y-3.5">
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-dark/40 cursor-pointer transition-colors text-sm">
              <span className="text-text-primary">A-Z (Uppercase Letters)</span>
              <input
                type="checkbox"
                checked={uppercase}
                onChange={(e) => setUppercase(e.target.checked)}
                className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30 w-4.5 h-4.5 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-dark/40 cursor-pointer transition-colors text-sm">
              <span className="text-text-primary">a-z (Lowercase Letters)</span>
              <input
                type="checkbox"
                checked={lowercase}
                onChange={(e) => setLowercase(e.target.checked)}
                className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30 w-4.5 h-4.5 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-dark/40 cursor-pointer transition-colors text-sm">
              <span className="text-text-primary">0-9 (Numbers)</span>
              <input
                type="checkbox"
                checked={numbers}
                onChange={(e) => setNumbers(e.target.checked)}
                className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30 w-4.5 h-4.5 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-dark/40 cursor-pointer transition-colors text-sm">
              <span className="text-text-primary">!@#$%^&* (Special Characters)</span>
              <input
                type="checkbox"
                checked={symbols}
                onChange={(e) => setSymbols(e.target.checked)}
                className="rounded border-border-dark bg-bg-dark text-accent-teal focus:ring-accent-teal/30 w-4.5 h-4.5 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* History panel (only in memory) */}
      {passwordHistory.length > 1 && (
        <div className="p-6 rounded-2xl bg-surface-dark border border-border-dark space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary/70">Recent Session History</h3>
          <div className="space-y-1.5">
            {passwordHistory.slice(1).map((histPass, index) => (
              <div 
                key={index}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-dark border border-border-dark/60 font-mono text-xs text-text-secondary select-all hover:bg-bg-dark transition-colors"
              >
                <span className="truncate max-w-[80%] tracking-wider">{histPass}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(histPass)}
                  className="text-[10px] text-accent-teal hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-secondary/40 italic">* History exists only in active memory and is wiped on lock, logout, or page reload.</p>
        </div>
      )}
    </div>
  );
}
