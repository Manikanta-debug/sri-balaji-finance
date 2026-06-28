import { collection, doc, getDoc, getDocs, runTransaction, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

const BATCH_DELETE_LIMIT = 450;
const DEFAULT_DAY_SESSIONS = ["morning", "afternoon"];

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function deleteDocRefs(refs) {
  const uniqueRefs = Array.from(new Map(refs.map((ref) => [ref.path, ref])).values());
  for (const refChunk of chunk(uniqueRefs, BATCH_DELETE_LIMIT)) {
    const batch = writeBatch(db);
    refChunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteBorrowersForVillage(sessionDocId, villageId) {
  const borrowersCol = collection(db, "lines", sessionDocId, "villages", villageId, "borrowers");
  const snapshot = await getDocs(borrowersCol);
  if (snapshot.empty) {
    return 0;
  }

  await deleteDocRefs(snapshot.docs.map((docSnap) => docSnap.ref));
  return snapshot.size;
}

async function deleteVillageCascade(sessionDocId, villageId) {
  const villageRef = doc(db, "lines", sessionDocId, "villages", villageId);
  await deleteBorrowersForVillage(sessionDocId, villageId);
  await deleteDocRefs([villageRef]);
}

async function deleteSessionCascade(sessionDocId) {
  const sessionRef = doc(db, "lines", sessionDocId);
  const villagesCol = collection(db, "lines", sessionDocId, "villages");
  const snapshot = await getDocs(villagesCol);

  for (const villageDoc of snapshot.docs) {
    await deleteVillageCascade(sessionDocId, villageDoc.id);
  }

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (sessionSnap.exists()) {
      transaction.delete(sessionRef);
    }
  });
}

async function deleteDayCascade(lineId, dayKey) {
  const lineRef = doc(db, "lines", lineId);
  const lineSnap = await getDoc(lineRef);

  if (!lineSnap.exists()) {
    throw new Error("Line not found");
  }

  const lineData = lineSnap.data();
  const dayData = lineData.days?.[dayKey];
  if (!dayData) {
    throw new Error(`Day '${dayKey}' not found`);
  }

  const sessions = Array.isArray(dayData.sessions) && dayData.sessions.length > 0
    ? dayData.sessions
    : DEFAULT_DAY_SESSIONS;

  for (const sessionKey of sessions) {
    const sessionDocId = `${lineId}_${dayKey}_${sessionKey}`;
    await deleteSessionCascade(sessionDocId);
  }

  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(lineRef);
    if (!freshSnap.exists()) {
      throw new Error("Line not found while updating day metadata");
    }
    const freshData = freshSnap.data();
    const currentDays = freshData.days || {};
    const { [dayKey]: omittedDay, ...remainingDays } = currentDays;
    void omittedDay;
    transaction.update(lineRef, { days: remainingDays });
  });
}

async function deleteSessionForDay(lineId, dayKey, sessionKey) {
  const lineRef = doc(db, "lines", lineId);
  const lineSnap = await getDoc(lineRef);

  if (!lineSnap.exists()) {
    throw new Error("Line not found");
  }

  const sessionDocId = `${lineId}_${dayKey}_${sessionKey}`;
  await deleteSessionCascade(sessionDocId);

  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(lineRef);
    if (!freshSnap.exists()) {
      throw new Error("Line not found while updating session metadata");
    }

    const freshData = freshSnap.data();
    const currentDays = freshData.days || {};
    const dayData = currentDays[dayKey];
    if (!dayData) {
      throw new Error(`Day '${dayKey}' not found`);
    }

    const nextSessions = (Array.isArray(dayData.sessions) ? dayData.sessions : []).filter((session) => session !== sessionKey);
    const nextDays = {
      ...currentDays,
      [dayKey]: {
        ...dayData,
        sessions: nextSessions,
      },
    };

    transaction.update(lineRef, { days: nextDays });
  });
}

async function deleteLineCascade(lineId) {
  const lineRef = doc(db, "lines", lineId);
  const lineSnap = await getDoc(lineRef);

  if (!lineSnap.exists()) {
    throw new Error("Line not found");
  }

  const lineData = lineSnap.data();
  const days = lineData.days || {};

  for (const [dayKey, dayData] of Object.entries(days)) {
    const sessions = Array.isArray(dayData?.sessions) && dayData.sessions.length > 0
      ? dayData.sessions
      : DEFAULT_DAY_SESSIONS;

    for (const sessionKey of sessions) {
      const sessionDocId = `${lineId}_${dayKey}_${sessionKey}`;
      await deleteSessionCascade(sessionDocId);
    }
  }

  const dailyStatsCol = collection(db, "lines", lineId, "dailyStats");
  const dailyStatsSnap = await getDocs(dailyStatsCol);
  if (!dailyStatsSnap.empty) {
    await deleteDocRefs(dailyStatsSnap.docs.map((docSnap) => docSnap.ref));
  }

  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(lineRef);
    if (!freshSnap.exists()) {
      return;
    }
    transaction.delete(lineRef);
  });
}

export {
  deleteBorrowersForVillage,
  deleteDayCascade,
  deleteLineCascade,
  deleteSessionCascade,
  deleteSessionForDay,
  deleteVillageCascade,
};
