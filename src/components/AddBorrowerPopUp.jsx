

import { useState } from "react";
import { db } from "../firebase";
import { useParams } from "react-router-dom";
import { collection, addDoc, getDocs, doc as firestoreDoc, updateDoc } from "firebase/firestore";
export default function AddBorrowerPopUp({ newCardNo, onAdd, onClose, borrower, onRepay }) {
  console.log(newCardNo)
  const isRepay = !!borrower;
  const [name, setName] = useState(borrower ? borrower.name : "");
  const [borrowed, setBorrowed] = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(borrower && borrower.loan && borrower.loan.startDate ? borrower.loan.startDate : todayStr);
  const [mobileNo, setMobileNo] = useState(borrower && borrower.mobileNo ? borrower.mobileNo : "");
  const [location, setLocation] = useState(borrower && borrower.location ? borrower.location : "");

  const { line, day, session } = useParams();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !borrowed || parseFloat(borrowed) < 0) return;
    setSubmitting(true);
    try {
      if (isRepay && borrower) {
        if (onRepay) {
          await onRepay({
            ...borrower,
            mobileNo: mobileNo || undefined,
            name: name.trim(),
            loan: {
              ...borrower.loan,
              borrowed: parseFloat(borrowed),
              startDate,
              payments: [],
            },
          });
        }
        onClose();
        return;
      }
      const newBorrower = {
        name: name.trim(),
        loan: {
          cardNo: newCardNo,
          borrowed: parseFloat(borrowed),
          startDate,
          payments: [],
        },
      };
      if (mobileNo && mobileNo.trim() !== "") newBorrower.mobileNo = mobileNo;
      if (location && location.trim() !== "") newBorrower.location = location;
      if (onAdd) {
        onAdd(newBorrower);
      }

      const linesCol = collection(db, "lines");
      const linesSnapshot = await getDocs(linesCol);
      let lineDocId = null;
      linesSnapshot.forEach(docSnap => {
        if (docSnap.data().line === line) lineDocId = docSnap.id;
      });
      if (lineDocId) {
        const lineRef = firestoreDoc(db, "lines", lineDocId);
        const lineData = linesSnapshot.docs.find(docSnap => docSnap.id === lineDocId).data();
        const prevDay = lineData.days[day] || { sessions: [], startDate: null };
        if (!onRepay && !prevDay.startDate) {
          const newDays = { ...lineData.days, [day]: { ...prevDay, startDate } };
          await updateDoc(lineRef, { days: newDays });
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-emerald-700 mb-4">{isRepay ? "Repay & Renew Loan" : "Add New Borrower"}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Borrower Name
            </label>
            <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter borrower name"
            required
            autoFocus={true}
            disabled={isRepay}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount Borrowed
            </label>
           <input
            type="number"
            value={borrowed}
            onChange={(e) => setBorrowed(e.target.value)}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter amount"
            min="0"
            step="0.01"
            required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter location"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number (optional)</label>
            <input
              type="tel"
              value={mobileNo}
              onChange={e => setMobileNo(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter mobile number"
              pattern="[0-9]*"
              inputMode="numeric"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? (isRepay ? "Renewing..." : "Adding...") : (isRepay ? "Repay & Renew" : "Add Borrower")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
