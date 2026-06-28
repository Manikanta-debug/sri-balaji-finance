import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AddLinePopUp from "../components/AddLinePopUp";
import DualCircleLoader from "../components/DualCircleLoader"
import DeleteIconButton from "../components/DeleteIconButton";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { deleteDayCascade, deleteLineCascade, deleteSessionForDay } from "../utils/firestoreCascadeDelete";
import { invalidateDashboardCache } from "../utils/dashboardCache";

const LineSessions = ({ unlockedLines, setUnlockedLines }) => {
  const { lineId, day } = useParams();
  const navigate = useNavigate();
  
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const sessions = ["morning", "afternoon"];
  
  const [entries, setEntries] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('line');
  const [loading, setLoading] = useState("");
  const [deletingKey, setDeletingKey] = useState("");

  const fetchLines = async () => {
    try {
      setLoading("fetchingLines");
      const linesCol = collection(db, "lines");
      const linesSnapshot = await getDocs(linesCol);
      const linesData = {};
      linesSnapshot.forEach(docSnap => {
        linesData[docSnap.id] = docSnap.data();
      });
      setEntries(linesData);
    } catch (error) {
      alert(error.message || error)
    } finally {
      setLoading("");
    }
  };

  useEffect(() => {
    fetchLines();
  }, []);

  // Handle password check if accessing a specific line
  useEffect(() => {
    if (lineId && !unlockedLines.includes(lineId) && entries[lineId]) {
      const entry = entries[lineId];
      const userPwd = window.prompt(`Enter password for ${entry.line}:`);
      if (userPwd === entry.password) {
        setUnlockedLines(prev => [...prev, lineId]);
      } else {
        alert("Incorrect password");
        navigate("/");
      }
    }
  }, [lineId, unlockedLines, entries, navigate, setUnlockedLines]);

  const addLine = async (line, password) => {
    setLoading("addLine");
    try {
      const docRef = await addDoc(collection(db, "lines"), {
        line,
        password,
        days: {}
      });
      setEntries(prev => ({
        ...prev,
        [docRef.id]: { line, password, days: {} }
      }));
    } catch (error) {
      alert(error.message || error);
    } finally {
      setLoading("");
    }
  };

  const addDay = async (lId, d, startDate) => {
    const lineData = entries[lId];
    const days = lineData?.days || {};
    if (Object.keys(days).includes(d)) {
      alert(`Day '${d.charAt(0).toUpperCase() + d.slice(1)}' already exists for this line.`);
      return;
    }
    setLoading("addDay");
    try {
      const lineRef = doc(db, "lines", lId);
      const newDays = { ...days, [d]: { sessions: ["morning", "afternoon"], startDate } };
      await updateDoc(lineRef, { days: newDays });
      invalidateDashboardCache(lId);
      setEntries(prev => ({
        ...prev,
        [lId]: {
          ...prev[lId],
          days: newDays
        }
      }));
    } catch (error) {
      alert(error.message || error);
    } finally {
      setLoading("");
    }
  };

  const onAdd = async (data) => {
    if (addMode === 'line') {
      await addLine(data.line, data.password);
    } else if (addMode === 'day') {
      await addDay(lineId, data.day, data.startDate);
    }
    setIsModalOpen(false);
  };

  const handleLineClick = (id) => {
    navigate(`/${id}`);
  };

  const handleDayClick = (d) => {
    navigate(`/${lineId}/${d}`);
  };

  const handleSessionClick = (session) => {
    navigate(`/${lineId}/${day}/${session}`);
  };

  const removeLineFromState = (targetLineId) => {
    setEntries((prev) => {
      const next = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (id !== targetLineId && !id.startsWith(`${targetLineId}_`)) {
          next[id] = value;
        }
      });
      return next;
    });
  };

  const handleDeleteLine = async (targetLineId, targetLineName) => {
    const confirmed = window.confirm(
      `Delete line "${targetLineName}"? This will permanently remove its days, sessions, villages, borrowers, and daily stats.`
    );
    if (!confirmed) return;

    setDeletingKey(`line:${targetLineId}`);
    try {
      await deleteLineCascade(targetLineId);
      removeLineFromState(targetLineId);
      invalidateDashboardCache(targetLineId);
      setUnlockedLines((prev) => prev.filter((id) => id !== targetLineId));
      if (lineId === targetLineId) {
        navigate("/");
      }
    } catch (error) {
      alert(error?.message || `Failed to delete line "${targetLineName}".`);
    } finally {
      setDeletingKey("");
    }
  };

  const handleDeleteDay = async (targetDay) => {
    const confirmed = window.confirm(
      `Delete day "${targetDay}"? This will permanently remove its sessions, villages, and borrowers.`
    );
    if (!confirmed) return;

    setDeletingKey(`day:${targetDay}`);
    try {
      await deleteDayCascade(lineId, targetDay);
      invalidateDashboardCache(lineId);
      setEntries((prev) => {
        const currentLine = prev[lineId];
        if (!currentLine) return prev;
        const days = currentLine.days || {};
        const { [targetDay]: omittedDay, ...remainingDays } = days;
        void omittedDay;
        return {
          ...prev,
          [lineId]: {
            ...currentLine,
            days: remainingDays,
          },
        };
      });
      navigate(`/${lineId}`);
    } catch (error) {
      alert(error?.message || `Failed to delete day "${targetDay}".`);
    } finally {
      setDeletingKey("");
    }
  };

  const handleDeleteSession = async (targetSession) => {
    const confirmed = window.confirm(
      `Delete session "${targetSession}"? This will permanently remove its villages and borrowers.`
    );
    if (!confirmed) return;

    setDeletingKey(`session:${targetSession}`);
    try {
      await deleteSessionForDay(lineId, day, targetSession);
      invalidateDashboardCache(lineId);
      setEntries((prev) => {
        const currentLine = prev[lineId];
        const currentDay = currentLine?.days?.[day];
        if (!currentLine || !currentDay) return prev;

        const nextSessions = (currentDay.sessions || []).filter((s) => s !== targetSession);
        return {
          ...prev,
          [lineId]: {
            ...currentLine,
            days: {
              ...currentLine.days,
              [day]: {
                ...currentDay,
                sessions: nextSessions,
              },
            },
          },
        };
      });
      navigate(`/${lineId}/${day}`);
    } catch (error) {
      alert(error?.message || `Failed to delete session "${targetSession}".`);
    } finally {
      setDeletingKey("");
    }
  };

  const handlePlusClick = () => {
    if (!lineId) {
      setAddMode('line');
      setIsModalOpen(true);
    } else if (lineId && !day) {
      setAddMode('day');
      setIsModalOpen(true);
    }
  };

  const uniqueLines = Object.entries(entries)
    .filter(([, e]) => e.line)
    .map(([id, e]) => ({ id, line: e.line }));
  const daysForLine = lineId && entries[lineId]?.days ? Object.keys(entries[lineId].days) : [];
  const sessionsForDay = lineId && day && entries[lineId]?.days?.[day]?.sessions ? entries[lineId].days[day].sessions : [];

  const isUnlocked = !lineId || unlockedLines.includes(lineId);

  if (loading === "fetchingLines") return <main className="min-h-screen bg-gray-50 flex items-center justify-center"><DualCircleLoader /></main>;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-500">
          Sri Balaji Finance
        </h1>
        <p className="mt-2 text-gray-600">
          {!lineId && 'Select a line'}
          {lineId && !day && `Days for ${entries[lineId]?.line?.toUpperCase() || ''}`}
          {lineId && day && `Sessions for ${entries[lineId]?.line?.toUpperCase() || ''} on ${day}`}
        </p>
      </div>

      {isUnlocked && (
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4">
          {/* Line List View */}
          {!lineId && (
            uniqueLines.length === 0 ? (
              <h2 className="text-center text-gray-500">No lines found. Add a new line.</h2>
            ) : (
              uniqueLines.map(({ id, line }) => (
                <div key={id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => handleLineClick(id)}
                    className="flex-1 py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                  >
                    {line.toUpperCase()}
                  </button>
                  <DeleteIconButton
                    label={`Delete line ${line}`}
                    disabled={deletingKey === `line:${id}`}
                    onClick={() => handleDeleteLine(id, line)}
                  />
                </div>
              ))
            )
          )}

          {/* Day List View */}
          {lineId && !day && (
            <>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
                >
                  ← Back to Lines
                </button>
                <button
                  onClick={() => navigate(`/dashboard/${lineId}`)}
                  className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 cursor-pointer text-sm font-medium"
                >
                  View Line Dashboard
                </button>
              </div>
              {daysForLine.length === 0 ? (
                <h2 className="text-center text-gray-500">No days found. Add a new day.</h2>
              ) : (
                daysForLine.map((d) => (
                  <div key={d} className="flex items-stretch gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => handleDayClick(d)}
                      className="flex-1 py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                    <DeleteIconButton
                      label={`Delete day ${d}`}
                      disabled={deletingKey === `day:${d}`}
                      onClick={() => handleDeleteDay(d)}
                    />
                  </div>
                ))
              )}
            </>
          )}

          {/* Session List View */}
          {lineId && day && (
            <>
              <button
                onClick={() => navigate(`/${lineId}`)}
                className="self-start mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
              >
                ← Back to Days
              </button>
              {sessionsForDay.length === 0 ? (
                <h2 className="text-center text-gray-500">No sessions found.</h2>
              ) : (
                sessionsForDay.map((session) => (
                  <div key={session} className="flex items-stretch gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleSessionClick(session)}
                      className="flex-1 py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                    >
                      {session.charAt(0).toUpperCase() + session.slice(1)}
                    </button>
                    <DeleteIconButton
                      label={`Delete session ${session}`}
                      disabled={deletingKey === `session:${session}`}
                      onClick={() => handleDeleteSession(session)}
                    />
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* Floating Add Button */}
      {(!lineId || (lineId && !day)) && (
        <button
          onClick={handlePlusClick}
          className="fixed right-5 bottom-5 w-14 h-14 rounded-full bg-white shadow-2xl shadow-yellow-400 flex items-center justify-center transition cursor-pointer"
        >
          <img className="w-10 h-10" src={`${import.meta.env.BASE_URL}plus.svg`} alt="add-entry" />
        </button>
      )}

      {isModalOpen && (
        <AddLinePopUp
          loading={loading}
          onSubmit={onAdd}
          days={days}
          sessions={sessions}
          setIsModalOpen={setIsModalOpen}
          addMode={addMode}
        />
      )}
    </main>
  );
};

LineSessions.propTypes = {
  unlockedLines: PropTypes.arrayOf(PropTypes.string).isRequired,
  setUnlockedLines: PropTypes.func.isRequired,
};

export default LineSessions;
