import { useEffect, useMemo, useState } from "react";
import { collection, getDoc, getDocs, doc, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeBorrowerRecord, toStorageDate } from "../utils/date";

export default function useLineDaySessionData({
  lineId,
  day,
  session,
  villageId,
  unlockedLines,
  setUnlockedLines,
  navigate,
}) {
  const [villages, setVillages] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [lineName, setLineName] = useState("");

  const selectedVillage = useMemo(
    () => villages.find((v) => v.id === villageId),
    [villages, villageId]
  );

  useEffect(() => {
    const checkAuth = async () => {
      if (lineId && !unlockedLines.includes(lineId)) {
        const lineRef = doc(db, "lines", lineId);
        const lineSnap = await getDoc(lineRef);
        if (lineSnap.exists()) {
          const entry = lineSnap.data();
          const userPwd = window.prompt(`Enter password for ${entry.line}:`);
          if (userPwd === entry.password) {
            setUnlockedLines((prev) => [...prev, lineId]);
            setLineName(entry.line);
          } else {
            alert("Incorrect password");
            navigate("/");
          }
        } else {
          navigate("/");
        }
      }
    };

    checkAuth();
  }, [lineId, unlockedLines, navigate, setUnlockedLines]);

  useEffect(() => {
    let isActive = true;

    const fetchLineInfoAndVillages = async () => {
      setLoading(true);
      try {
        const lineRef = doc(db, "lines", lineId);
        const lineSnap = await getDoc(lineRef);
        if (lineSnap.exists()) {
          const lineData = lineSnap.data();
          setLineName(lineData.line);
          const days = lineData.days || {};
          if (days[day]) {
            setStartDate(toStorageDate(days[day].startDate || null));
          }
        }

        const sessionDocId = `${lineId}_${day}_${session}`;
        const villagesCol = collection(db, "lines", sessionDocId, "villages");
        const snapshot = await getDocs(villagesCol);
        const villageData = snapshot.docs.map((vDoc) => ({
          id: vDoc.id,
          ...vDoc.data(),
        }));

        if (isActive) {
          setVillages(villageData);
        }
      } catch (error) {
        console.error("Error fetching villages:", error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    if (lineId && unlockedLines.includes(lineId)) {
      fetchLineInfoAndVillages();
    }

    return () => {
      isActive = false;
    };
  }, [lineId, day, session, unlockedLines]);

  useEffect(() => {
    let isActive = true;

    const fetchBorrowers = async () => {
      if (!villageId || !unlockedLines.includes(lineId)) {
        setBorrowers([]);
        return;
      }

      setLoading(true);
      try {
        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowersCol = query(
          collection(db, "lines", sessionDocId, "villages", villageId, "borrowers"),
          orderBy("loan.cardNo", "asc")
        );
        const snapshot = await getDocs(borrowersCol);
        const data = snapshot.docs.map((snap) =>
          normalizeBorrowerRecord({ ...snap.data(), id: snap.id })
        );

        if (isActive) {
          setBorrowers(data);
        }
      } catch (error) {
        console.error("Error fetching borrowers:", error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchBorrowers();

    return () => {
      isActive = false;
    };
  }, [villageId, lineId, day, session, unlockedLines]);

  return {
    borrowers,
    loading,
    lineName,
    selectedVillage,
    setBorrowers,
    setLineName,
    setLoading,
    setStartDate,
    setVillages,
    startDate,
    villages,
  };
}
