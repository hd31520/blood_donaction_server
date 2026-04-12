const cacheStore = new Map();

const now = () => Date.now();

export const buildCacheKey = (prefix, parts) => {
  return `${prefix}:${JSON.stringify(parts)}`;
};

export const getCachedValue = (key) => {
  const item = cacheStore.get(key);
  if (!item) {
    return null;
  }

  if (item.expiresAt <= now()) {
    cacheStore.delete(key);
    return null;
  }

  return item.value;
};

export const setCachedValue = (key, value, ttlMs) => {
  cacheStore.set(key, {
    value,
    expiresAt: now() + ttlMs,
  });
};

export const getOrSetCached = async (key, ttlMs, producer) => {
  const cached = getCachedValue(key);
  if (cached !== null) {
    return cached;
  }

  const value = await producer();
  setCachedValue(key, value, ttlMs);
  return value;
};
