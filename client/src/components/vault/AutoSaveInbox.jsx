/* global chrome */

import { useCallback, useEffect, useState } from 'react';
import { Check, Edit3, Eye, EyeOff, Inbox, Loader2, Search, Trash2, X } from 'lucide-react';
import { useVault } from '../../contexts/VaultContext';
import { isExtension, isNative } from '../../utils/platform';
import { vaultBridge } from '../../services/android/vaultBridge';

const emptyDraft = { title: '', website: '', username: '', password: '', category: 'General' };

export default function AutoSaveInbox() {
  const { entries, addEntry, updateEntry } = useVault();
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isExtension) {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PENDING_CREDENTIALS' });
        if (!response?.success) throw new Error(response?.error || 'Vault is locked.');
        setItems(response.credentials || []);
      } else if (isNative) {
        setItems(await vaultBridge.getPendingCredentials());
      }
    } catch (err) {
      setError(err.message || 'Unable to load Auto-Save Inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  // The inbox is an external local/native store; load it when the view mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadItems(); }, [loadItems]);

  const beginEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      title: item.title || '',
      website: item.website || '',
      username: item.username || '',
      password: item.password || '',
      category: item.category || 'General',
    });
    setShowPassword(false);
  };

  const updateDraft = (field, value) => setDraft(current => ({ ...current, [field]: value }));

  const approve = async (item) => {
    const data = editingId === item.id ? draft : {
      title: item.title || 'New credential',
      website: item.website || '',
      username: item.username || '',
      password: item.password || '',
      category: item.category || 'General',
    };
    if (!data.password) {
      setError('Add a password before approving this item.');
      return;
    }
    setApprovingId(item.id);
    setError('');
    try {
      let existingId = item.existingId;
      if (!existingId) {
        const match = entries.find(entry => entry.website && data.website &&
          entry.website.toLowerCase().includes(data.website.toLowerCase().replace(/^https?:\/\//, '').split('/')[0]) &&
          (entry.username || '').toLowerCase() === (data.username || '').toLowerCase());
        existingId = match?._id;
      }
      if (existingId) await updateEntry(existingId, data);
      else await addEntry(data);
      if (isExtension) await chrome.runtime.sendMessage({ action: 'DELETE_PENDING_CREDENTIAL', id: item.id });
      else await vaultBridge.deletePendingCredential(item.id);
      setItems(current => current.filter(candidate => candidate.id !== item.id));
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not approve this credential.');
    } finally {
      setApprovingId(null);
    }
  };

  const saveEdit = async (item) => {
    setBusyId(item.id);
    try {
      if (isExtension) await chrome.runtime.sendMessage({ action: 'UPDATE_PENDING_CREDENTIAL', id: item.id, data: draft });
      else await vaultBridge.updatePendingCredential(item.id, draft);
      setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, ...draft } : candidate));
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not update this inbox item.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (item) => {
    setBusyId(item.id);
    try {
      if (isExtension) await chrome.runtime.sendMessage({ action: 'DELETE_PENDING_CREDENTIAL', id: item.id });
      else await vaultBridge.deletePendingCredential(item.id);
      setItems(current => current.filter(candidate => candidate.id !== item.id));
      if (editingId === item.id) setEditingId(null);
    } catch (err) {
      setError(err.message || 'Could not reject this item.');
    } finally {
      setBusyId(null);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter(item => [item.title, item.website, item.username, item.category]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch)))
    : items;

  return (
    <section className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-text-primary font-extrabold text-sm">
            <Inbox className="w-4 h-4 text-accent-teal" /> Auto-Save Inbox
            <span className="rounded-full bg-accent-teal/15 px-2 py-0.5 text-[10px] text-accent-teal">{items.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">Captured locally. Nothing reaches the server until you approve it.</p>
        </div>
        <button onClick={loadItems} className="cursor-pointer text-[10px] text-accent-teal hover:text-white">Refresh</button>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <input
          type="search"
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Search inbox"
          className="w-full rounded-xl border border-border-dark bg-surface-dark py-2 pl-9 pr-4 text-xs text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent-teal"
        />
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">{error}</div>}
      {loading && <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-accent-teal" /></div>}
      {!loading && items.length === 0 && <div className="rounded-xl border border-dashed border-border-dark p-8 text-center text-xs text-text-secondary">No pending credentials.</div>}
      {!loading && items.length > 0 && filteredItems.length === 0 && <div className="rounded-xl border border-dashed border-border-dark p-8 text-center text-xs text-text-secondary">No inbox items match your search.</div>}

      {!loading && filteredItems.map(item => {
        const isEditing = editingId === item.id;
        const values = isEditing ? draft : item;
        const isUpdated = item.kind === 'updated';
        return (
          <article key={item.id} className={`rounded-xl border p-3 ${isUpdated ? 'border-amber-400/30 bg-amber-400/5' : 'border-emerald-400/30 bg-emerald-400/5'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isUpdated ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {isUpdated ? 'Updated credential' : 'New credential'}
                </div>
                <div className="mt-1 truncate text-sm font-bold text-text-primary">{values.title || values.website || 'Untitled credential'}</div>
                <div className="truncate text-[10px] text-text-secondary">{values.website}</div>
              </div>
              {!isEditing && <button onClick={() => beginEdit(item)} className="cursor-pointer rounded-md p-1 text-text-secondary hover:bg-surface-hover hover:text-white" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>}
            </div>

            {isEditing ? (
              <div className="mt-3 grid gap-2">
                {['title', 'website', 'username'].map(field => (
                  <input key={field} type="text" value={values[field] || ''} onChange={e => updateDraft(field, e.target.value)} placeholder={field[0].toUpperCase() + field.slice(1)} className="w-full rounded-lg border border-border-dark bg-bg-dark px-2.5 py-2 text-xs text-text-primary outline-none focus:border-accent-teal" />
                ))}
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={values.password || ''} onChange={e => updateDraft('password', e.target.value)} placeholder="Password" className="w-full rounded-lg border border-border-dark bg-bg-dark px-2.5 py-2 pr-9 text-xs text-text-primary outline-none focus:border-accent-teal" />
                  <button type="button" onClick={() => setShowPassword(current => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-text-secondary hover:text-text-primary" title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-text-secondary"><span className="text-text-primary">{values.username || '(username missing)'}</span><span className="mx-1">·</span>{values.password ? 'password captured' : 'password missing'}</div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              {isEditing && <button onClick={() => { setEditingId(null); setShowPassword(false); }} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] text-text-secondary hover:bg-surface-hover"><X className="mr-1 inline h-3 w-3" />Cancel</button>}
              {isEditing && <button onClick={() => saveEdit(item)} disabled={busyId === item.id} className="cursor-pointer rounded-lg bg-surface-dark px-2.5 py-1.5 text-[10px] font-bold text-accent-teal disabled:cursor-not-allowed disabled:opacity-50">Save edit</button>}
              <button onClick={() => reject(item)} disabled={busyId === item.id} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="mr-1 inline h-3 w-3" />Reject</button>
              <button onClick={() => approve(item)} disabled={approvingId === item.id || busyId === item.id} className="flex cursor-pointer items-center rounded-lg bg-accent-teal px-2.5 py-1.5 text-[10px] font-extrabold text-bg-dark disabled:cursor-not-allowed disabled:opacity-70">
                {approvingId === item.id ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Saving...</> : <><Check className="mr-1 inline h-3 w-3" />Approve</>}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
