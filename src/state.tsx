import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Analysis, ParseResult, Settings } from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import { analyze } from './lib/analyze';
import { loadBackupFile } from './lib/loadBackup';

const SETTINGS_KEY = 'mpesa.settings.v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      excludedPeople: Array.isArray(s.excludedPeople)
        ? s.excludedPeople.filter((x) => typeof x === 'string')
        : DEFAULT_SETTINGS.excludedPeople,
      extraBars: Array.isArray(s.extraBars) ? s.extraBars.filter((x) => typeof x === 'string') : DEFAULT_SETTINGS.extraBars,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — keep in memory */
  }
}

export interface AppState {
  parse: ParseResult | null;
  analysis: Analysis | null;
  analysisError: string | null;
  settings: Settings;
  setSettings: (s: Settings) => void;
  loading: boolean;
  loadError: string | null;
  fileName: string | null;
  loadFile: (f: File) => Promise<boolean>;
  reset: () => void;
}

export const AppCtx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
/** For pages rendered only when data is loaded. */
export function useAnalysis(): Analysis {
  const a = useApp().analysis;
  if (!a) throw new Error('No analysis loaded');
  return a;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [loading, setLoading] = useState(false);
  const [fileError, setLoadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const { analysis, analysisError } = useMemo(() => {
    if (!parse) return { analysis: null, analysisError: null };
    try {
      return { analysis: analyze(parse, settings), analysisError: null };
    } catch (e) {
      console.error(e);
      return { analysis: null, analysisError: e instanceof Error ? e.message : String(e) };
    }
  }, [parse, settings]);

  const loadFile = useCallback(async (f: File) => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await loadBackupFile(f);
      if (!p.txns.length)
        throw new Error('No M-PESA transactions were found in this backup. Make sure the export includes messages from MPESA.');
      setParse(p);
      setFileName(f.name);
      return true;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setParse(null);
    setFileName(null);
    setLoadError(null);
  }, []);

  // One error selector: a file-loading error wins; otherwise surface an analysis failure with its prefix.
  const loadError = fileError ?? (analysisError ? 'The file was read, but analysing it failed: ' + analysisError : null);

  const value = useMemo<AppState>(
    () => ({ parse, analysis, analysisError, settings, setSettings, loading, loadError, fileName, loadFile, reset }),
    [parse, analysis, analysisError, settings, setSettings, loading, loadError, fileName, loadFile, reset],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
