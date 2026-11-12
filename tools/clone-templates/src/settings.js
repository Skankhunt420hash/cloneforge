import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './theme.js';

// App-Einstellungen (lokal gespeichert): Darstellung, Willkommens-Tour, KI-Zugang, Server-Verbindung
const KEY = 'app_settings';
const SAVED = ['mode', 'accent', 'onboarded', 'aiKey', 'aiModel', 'serverUrl', 'serverToken'];
let state = { mode: 'auto', accent: null, onboarded: false, aiKey: '', aiModel: '', serverUrl: '', serverToken: '', loaded: false };
const subs = new Set();
const notify = () => subs.forEach(fn => { try { fn(state); } catch (e) { /* egal */ } });
let initPromise = null;

export const getSettings = () => state;
export function subscribeSettings(fn) { subs.add(fn); return () => subs.delete(fn); }

export function initSettings() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) state = { ...state, ...JSON.parse(raw) }; } catch (e) { /* Standardwerte */ }
    state = { ...state, loaded: true };
    applyTheme(state);
    notify();
    return state;
  })();
  return initPromise;
}

export async function updateSettings(patch) {
  state = { ...state, ...patch };
  applyTheme(state);
  notify();
  const keep = {};
  for (const k of SAVED) keep[k] = state[k];
  try { await AsyncStorage.setItem(KEY, JSON.stringify(keep)); } catch (e) { /* egal */ }
}

export function useSettings() {
  const [, tick] = useState(0);
  useEffect(() => subscribeSettings(() => tick(n => n + 1)), []);
  return state;
}
