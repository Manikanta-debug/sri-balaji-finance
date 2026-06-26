import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AddLinePopUp from "../components/AddLinePopUp";
import DualCircleLoader from "../components/DualCircleLoader"
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";

const LineSessions = ({ unlockedLines, setUnlockedLines }) => {
  const { lineId, day } = useParams();
  const navigate = useNavigate();
  
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const sessions = ["morning", "afternoon"];
  
  const [entries, setEntries] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('line');
  const [loading, setLoading] = useState("");

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
    if (lineData.days && Object.keys(lineData.days).includes(d)) {
      alert(`Day '${d.charAt(0).toUpperCase() + d.slice(1)}' already exists for this line.`);
      return;
    }
    setLoading("addDay");
    try {
      const lineRef = doc(db, "lines", lId);
      const newDays = { ...lineData.days, [d]: { sessions: ["morning", "afternoon"], startDate } };
      await updateDoc(lineRef, { days: newDays });
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
    .filter(([id, e]) => e.line)
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
                <button
                  key={id}
                  onClick={() => handleLineClick(id)}
                  className="py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                >
                  {line.toUpperCase()}
                </button>
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
                  <button
                    key={d}
                    onClick={() => handleDayClick(d)}
                    className="py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 mb-4 w-full cursor-pointer"
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
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
                  <button
                    key={session}
                    onClick={() => handleSessionClick(session)}
                    className="py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer mb-2"
                  >
                    {session.charAt(0).toUpperCase() + session.slice(1)}
                  </button>
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

export default LineSessions;
