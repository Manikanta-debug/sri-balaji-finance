import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  getDashboardBaseCache,
  getDashboardDailyCache,
  setDashboardBaseCache,
  setDashboardDailyCache,
} from "../utils/dashboardCache";

const emptyData = {
  lineStats: { totalBorrowed: 0, totalRepaid: 0, totalBorrowers: 0 },
  villageStats: [],
  dailyStats: {
    morning: { borrowed: 0, repaid: 0 },
    afternoon: { borrowed: 0, repaid: 0 },
    totalBorrowed: 0,
    totalRepaid: 0,
  },
};

export default function useDashboardData(lineId, filterDate, navigate) {
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [lineName, setLineName] = useState("");
  const [data, setData] = useState(emptyData);

  useEffect(() => {
    let isActive = true;

    const fetchBaseData = async () => {
      if (!lineId) return;

      const cachedBase = getDashboardBaseCache(lineId);
      if (cachedBase) {
        setLineName(cachedBase.lineName);
        setData((prev) => ({
          ...prev,
          lineStats: cachedBase.lineStats,
          villageStats: cachedBase.villageStats,
        }));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const lineRef = doc(db, "lines", lineId);
        const lineSnap = await getDoc(lineRef);
        if (!lineSnap.exists()) {
          alert("Line not found");
          navigate("/");
          return;
        }

        const lineData = lineSnap.data();
        const lineStats = lineData.stats || {
          totalBorrowed: 0,
          totalRepaid: 0,
          totalBorrowers: 0,
        };
        const days = lineData.days || {};
        const villageStats = [];
        const queryPromises = [];

        for (const dKey in days) {
          const sessions = days[dKey].sessions || [];
          for (const session of sessions) {
            const sessionDocId = `${lineId}_${dKey}_${session}`;
            const villagesCol = collection(db, "lines", sessionDocId, "villages");
            queryPromises.push(getDocs(villagesCol));
          }
        }

        const results = await Promise.all(queryPromises);
        for (const villagesSnap of results) {
          for (const vDoc of villagesSnap.docs) {
            const vData = vDoc.data();
            const vStats = vData.stats || {
              totalBorrowed: 0,
              totalRepaid: 0,
              totalBorrowers: 0,
            };
            const sessionDocId = vDoc.ref.parent.parent?.id;
            if (!sessionDocId) continue;
            const [, dayKey, sessionKey] = sessionDocId.split("_");

            villageStats.push({
              key: vDoc.ref.path,
              name: vData.name,
              day: dayKey,
              session: sessionKey,
              borrowed: vStats.totalBorrowed || 0,
              repaid: vStats.totalRepaid || 0,
              borrowers: vStats.totalBorrowers || 0,
            });
          }
        }

        if (!isActive) return;

        setLineName(lineData.line);
        setData((prev) => ({
          ...prev,
          lineStats,
          villageStats,
        }));
        setDashboardBaseCache(lineId, {
          lineName: lineData.line,
          lineStats,
          villageStats,
        });
      } catch (error) {
        console.error("Error fetching dashboard base data:", error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchBaseData();

    return () => {
      isActive = false;
    };
  }, [lineId, navigate]);

  useEffect(() => {
    let isActive = true;

    const fetchDailyStats = async () => {
      if (!filterDate || !lineId) return;

      const cachedDaily = getDashboardDailyCache(lineId, filterDate);
      if (cachedDaily) {
        setData((prev) => ({
          ...prev,
          dailyStats: cachedDaily,
        }));
        setCollectionLoading(false);
        return;
      }

      setCollectionLoading(true);
      try {
        const dailyRef = doc(db, "lines", lineId, "dailyStats", filterDate);
        const dailySnap = await getDoc(dailyRef);
        const stats = dailySnap.exists()
          ? dailySnap.data()
          : {
              morning: { borrowed: 0, repaid: 0 },
              afternoon: { borrowed: 0, repaid: 0 },
              totalBorrowed: 0,
              totalRepaid: 0,
            };

        if (!isActive) return;

        setData((prev) => ({
          ...prev,
          dailyStats: stats,
        }));
        setDashboardDailyCache(lineId, filterDate, stats);
      } catch (error) {
        console.error("Error fetching daily stats:", error);
      } finally {
        if (isActive) {
          setCollectionLoading(false);
        }
      }
    };

    fetchDailyStats();

    return () => {
      isActive = false;
    };
  }, [lineId, filterDate]);

  return {
    collectionLoading,
    data,
    lineName,
    loading,
    setData,
    setLineName,
  };
}
