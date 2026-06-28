const dashboardBaseCache = new Map();
const dashboardDailyCache = new Map();

export const getDashboardBaseCache = (lineId) => dashboardBaseCache.get(lineId);

export const setDashboardBaseCache = (lineId, value) => {
  dashboardBaseCache.set(lineId, value);
};

export const getDashboardDailyCache = (lineId, filterDate) =>
  dashboardDailyCache.get(`${lineId}:${filterDate}`);

export const setDashboardDailyCache = (lineId, filterDate, value) => {
  dashboardDailyCache.set(`${lineId}:${filterDate}`, value);
};

export const invalidateDashboardCache = (lineId) => {
  dashboardBaseCache.delete(lineId);
  for (const key of dashboardDailyCache.keys()) {
    if (key.startsWith(`${lineId}:`)) {
      dashboardDailyCache.delete(key);
    }
  }
};
