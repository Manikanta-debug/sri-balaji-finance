import "./App.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import DualCircleLoader from "./components/DualCircleLoader";

const LineSessions = lazy(() => import("./pages/LineSessions"));
const LineDaySession = lazy(() => import("./pages/LineDaySession"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const App = () => {
  const [isAllowed, setIsAllowed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("isAllowed")) || false;
    } catch {
      return false;
    }
  });
  const [hasPrompted, setHasPrompted] = useState(false);
  const [unlockedLines, setUnlockedLines] = useState([]);

  useEffect(() => {
    if (isAllowed || hasPrompted) return;

    const checkPassword = async () => {
      setHasPrompted(true);
      const response = window.prompt("Enter password");
      if (!response) {
        return;
      }
      try {
        const settingsRef = doc(db, "settings", "app");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (response === data.password) {
            localStorage.setItem("isAllowed", JSON.stringify(true));
            setIsAllowed(true);
          } else {
            alert("Incorrect password");
          }
        } else {
          alert("Password not set.");
        }
      } catch (e) {
        alert("Error checking password: " + (e.message || e));
      }
    };

    checkPassword();
  }, [isAllowed, hasPrompted]);

  if (!isAllowed) {
    return null;
  }

  const commonProps = { unlockedLines, setUnlockedLines };

  return (
    <Router basename="/sri-balaji-finance">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <DualCircleLoader />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<LineSessions {...commonProps} />} />
          <Route path="/:lineId" element={<LineSessions {...commonProps} />} />
          <Route path="/:lineId/:day" element={<LineSessions {...commonProps} />} />
          <Route path="/:lineId/:day/:session" element={<LineDaySession {...commonProps} />} />
          <Route path="/:lineId/:day/:session/:villageId" element={<LineDaySession {...commonProps} />} />
          <Route path="/dashboard/:lineId" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
