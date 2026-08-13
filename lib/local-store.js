const store = globalThis.__amitSalonLocalStore || {
  visits: new Map(),
  ratings: new Map(),
};

if (process.env.NODE_ENV === "development") globalThis.__amitSalonLocalStore = store;

export function localVisitorStats(sessionId, visitorId) {
  const now = Date.now();
  if (sessionId) store.visits.set(sessionId, { visitorId, lastSeen: now });
  const online = [...store.visits.values()].filter((visit) => now - visit.lastSeen <= 45000).length;
  const total = store.visits.size;
  return { online, total, visited: total, localFallback: true };
}

export function localRatingSummary(visitorId, rating) {
  if (visitorId && rating) store.ratings.set(visitorId, rating);
  const values = [...store.ratings.values()];
  const average = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;
  return { average, count: values.length, userRating: store.ratings.get(visitorId) || 0, localFallback: true };
}
