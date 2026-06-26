import "./App.css";
import LineSessions from "./pages/LineSessions";
import LineDaySession from "./pages/LineDaySession";
import Dashboard from "./pages/Dashboard";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const App = () => {
  const [isAllowed, setIsAllowed] = useState(JSON.parse(localStorage.getItem("isAllowed")) || false);
  const [checking, setChecking] = useState(false);
  const [unlockedLines, setUnlockedLines] = useState([]);

  async function checkPassword() {
    setChecking(true);
    const response = window.prompt("Enter password");
    if (!response) {
      setChecking(false);
      return;
    }
    try {
      const settingsRef = doc(db, "settings", "app");
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (response === data.password) {
          localStorage.setItem("isAllowed", true);
          setIsAllowed(true);
        } else {
          alert("Incorrect password");
        }
      } else {
        alert("Password not set.");
      }
    } catch (e) {
      alert("Error checking password: " + (e.message || e));
    } finally {
      setChecking(false);
    }
  }

  if (!isAllowed && !checking) {
    checkPassword();
    return null;
  }
  if (!isAllowed) {
    return null;
  }

  const commonProps = { unlockedLines, setUnlockedLines };

  return (
    <Router basename="/sri-balaji-finance">
      <Routes>
        <Route path="/" element={<LineSessions {...commonProps} />} />
        <Route path="/:lineId" element={<LineSessions {...commonProps} />} />
        <Route path="/:lineId/:day" element={<LineSessions {...commonProps} />} />
        <Route path="/:lineId/:day/:session" element={<LineDaySession {...commonProps} />} />
        <Route path="/:lineId/:day/:session/:villageId" element={<LineDaySession {...commonProps} />} />
        <Route path="/dashboard/:lineId" element={<Dashboard />} />
      </Routes>
    </Router>
  );
};

export default App;