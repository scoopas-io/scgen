import { useCallback } from "react";

const CACHE_KEY = "audio-generator-cache";
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  version: number;
  timestamp: number;
  stats: { artists: number; albums: number; songs: number };
  artists: any[];
  albums: any[];
  songs: any[];
}

export function useAudioGeneratorCache() {
  const loadFromCache = useCallback((): CachedData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CachedData = JSON.parse(cached);
      
      // Check version compatibility
      if (data.version !== CACHE_VERSION) {
        console.log("Cache version mismatch, clearing");
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      // Check if cache is too old
      if (Date.now() - data.timestamp > CACHE_MAX_AGE_MS) {
        console.log("Cache expired, clearing");
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      console.log(`Loaded ${data.songs.length} songs from cache (${Math.round((Date.now() - data.timestamp) / 1000 / 60)} min old)`);
      return data;
    } catch (error) {
      console.error("Error loading from cache:", error);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  const saveToCache = useCallback((
    stats: { artists: number; albums: number; songs: number },
    artists: any[],
    albums: any[],
    songs: any[]
  ) => {
    try {
      const data: CachedData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        stats,
        artists,
        albums,
        songs,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log(`Saved ${songs.length} songs to cache`);
    } catch (error) {
      console.error("Error saving to cache:", error);
      // If localStorage is full, try to clear old cache
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {}
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log("Cache cleared");
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, []);

  const getCacheAge = useCallback((): number | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const data: CachedData = JSON.parse(cached);
      return Date.now() - data.timestamp;
    } catch {
      return null;
    }
  }, []);

  return {
    loadFromCache,
    saveToCache,
    clearCache,
    getCacheAge,
  };
}
