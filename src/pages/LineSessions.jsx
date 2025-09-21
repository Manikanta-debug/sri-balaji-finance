import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddLinePopUp from "../components/AddLinePopUp";
import DualCircleLoader from "../components/DualCircleLoader"
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";

const LineSessions = () => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const sessions = ["morning", "afternoon"];
  const [entries, setEntries] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState('lines');
  const [selectedLineId, setSelectedLineId] = useState(null); // Firestore doc id
  const [selectedDay, setSelectedDay] = useState(null);
  const [addMode, setAddMode] = useState('line'); // 'line', 'day', 'session'
  const [loading, setLoading] = useState("")
  const navigate = useNavigate();

  const fetchLines = async () => {
    try {
      setLoading("fetchingLines")
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
      setLoading("")
    }
  };

  useEffect(() => {
    fetchLines();
  }, []);

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

  const addDay = async (lineId, day) => {
    const lineData = entries[lineId];
    if (lineData.days && Object.keys(lineData.days).includes(day)) {
      alert(`Day '${day.charAt(0).toUpperCase() + day.slice(1)}' already exists for this line.`);
      return;
    }
    setLoading("addDay");
    try {
      const lineRef = doc(db, "lines", lineId);
      // Add both sessions by default
      const newDays = { ...lineData.days, [day]: { sessions: ["morning", "afternoon"], startDate: null } };
      await updateDoc(lineRef, { days: newDays });
      setEntries(prev => ({
        ...prev,
        [lineId]: {
          ...prev[lineId],
          days: newDays
        }
      }));
    } catch (error) {
      alert(error.message || error);
    } finally {
      setLoading("");
    }
  };

  const addSession = async (lineId, day, session) => {
    setLoading("addSession");
    try {
      const lineRef = doc(db, "lines", lineId);
      const lineData = entries[lineId];
      const prevDay = lineData.days[day] || { sessions: [], startDate: null };
      const newSessions = [...(prevDay.sessions || []), session];
      const newDays = { ...lineData.days, [day]: { ...prevDay, sessions: newSessions } };
      await updateDoc(lineRef, { days: newDays });
      setEntries(prev => ({
        ...prev,
        [lineId]: {
          ...prev[lineId],
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
      await addDay(selectedLineId, data.day);
    } else if (addMode === 'session') {
      await addSession(selectedLineId, selectedDay, data.session);
    }
    setIsModalOpen(false);
  };

  const handleLineClick = (id) => {
    const entry = entries[id];
    const userPwd = window.prompt(`Enter password for ${entry.line}:`);
    if (entry && entry.password === userPwd) {
      setSelectedLineId(id);
      setCurrentView('days');
    } else {
      window.alert("Incorrect password");
    }
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setCurrentView('sessions');
  };

  const handleSessionClick = (session) => {
  const lineName = entries[selectedLineId]?.line || '';
  navigate(`/${selectedLineId}-${lineName}/${selectedDay}/${session}`);
  };

  const backToLines = () => {
    setCurrentView('lines');
    setSelectedLineId(null);
    setSelectedDay(null);
  };

  const backToDays = () => {
    setCurrentView('days');
    setSelectedDay(null);
  };

  const uniqueLines = Object.entries(entries).map(([id, e]) => ({ id, line: e.line }));
  const daysForLine = selectedLineId && entries[selectedLineId]?.days ? Object.keys(entries[selectedLineId].days) : [];
  const sessionsForDay = selectedLineId && selectedDay && entries[selectedLineId]?.days?.[selectedDay]?.sessions ? entries[selectedLineId].days[selectedDay].sessions : [];

  const handlePlusClick = () => {
    if (currentView === 'lines') {
      setAddMode('line');
      setIsModalOpen(true);
    } else if (currentView === 'days') {
      setAddMode('day');
      setIsModalOpen(true);
    }
    // Remove add session pop up, sessions are added by default
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-700">
          Reddy Finance
        </h1>
        <p className="mt-2 text-gray-600">
          {currentView === 'lines' && 'Select a line'}
          {currentView === 'days' && `Days for ${selectedLineId && entries[selectedLineId]?.line ? entries[selectedLineId].line.toUpperCase() : ''}`}
          {currentView === 'sessions' && `Sessions for ${selectedLineId && entries[selectedLineId]?.line ? entries[selectedLineId].line.toUpperCase() : ''} on ${selectedDay || ''}`}
        </p>
      </div>
      {loading === "fetchingLines" && <DualCircleLoader />}
      {loading === "" && <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4">
        {currentView === 'lines' && (
          uniqueLines.length === 0 ? (
            <h2>No lines found. Add a new line.</h2>
          ) : (
            uniqueLines.map(({ id, line }) => (
              <button
                key={id}
                onClick={() => handleLineClick(id)}
                className="py-3 px-4 bg-emerald-50 rounded-lg text-emerald-700 text-lg md:text-xl text-center font-medium hover:bg-emerald-600 hover:text-white transition-all duration-200"
              >
                {line.toUpperCase()}
              </button>
            ))
          )
        )}

        {currentView === 'days' && (
          <>
            <button
              onClick={backToLines}
              className="self-start mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ← Back to Lines
            </button>
            {daysForLine.length === 0 ? (
              <h2>No days found. Add a new day.</h2>
            ) : (
              daysForLine.map((day) => (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className="py-3 px-4 bg-emerald-50 rounded-lg text-emerald-700 text-lg md:text-xl text-center font-medium hover:bg-emerald-600 hover:text-white transition-all duration-200"
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
              ))
            )}
          </>
        )}

        {currentView === 'sessions' && (
          <>
            <button
              onClick={backToDays}
              className="self-start mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ← Back to Days
            </button>
            {sessionsForDay.length === 0 ? (
              <h2>No sessions found.</h2>
            ) : (
              sessionsForDay.map((session) => (
                <button
                  key={session}
                  onClick={() => handleSessionClick(session)}
                  className="py-3 px-4 bg-emerald-50 rounded-lg text-emerald-700 text-lg md:text-xl text-center font-medium hover:bg-emerald-600 hover:text-white transition-all duration-200"
                >
                  {session.charAt(0).toUpperCase() + session.slice(1)}
                </button>
              ))
            )}
          </>
        )}
      </div>}

      <button
        onClick={handlePlusClick}
        className="fixed right-5 bottom-5 w-14 h-14 rounded-full bg-white shadow-2xl shadow-emerald-600 flex items-center justify-center transition cursor-pointer"
      >
        <img className="w-10 h-10" src={`${import.meta.env.BASE_URL}plus.svg`} alt="add-entry" />
      </button>

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
