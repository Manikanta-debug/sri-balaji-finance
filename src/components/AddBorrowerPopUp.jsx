

import { useState } from "react";
import { db } from "../firebase";
import { useParams } from "react-router-dom";
import { getDoc, doc as firestoreDoc, updateDoc } from "firebase/firestore";
import { getLocalDateInputValue, toStorageDate } from "../utils/date";
const AddBorrowerPopUp = ({ onAdd, onClose, borrower, onRepay }) => {
  const isRepay = !!borrower;
  const [name, setName] = useState(borrower ? borrower.name : "");
  const [borrowed, setBorrowed] = useState(borrower ? borrower.loan?.borrowed || "" : "");
  const [cardNo, setCardNo] = useState(borrower ? borrower.loan?.cardNo || "" : "");
  const todayStr = getLocalDateInputValue();
  const [startDate, setStartDate] = useState(borrower && borrower.loan && borrower.loan.startDate ? toStorageDate(borrower.loan.startDate) : todayStr);
  const [mobileNo, setMobileNo] = useState(borrower && borrower.mobileNo ? borrower.mobileNo : "");
  const [location, setLocation] = useState(borrower && borrower.location ? borrower.location : "");

  const { lineId, day } = useParams();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !borrowed || parseFloat(borrowed) < 0) return;
    if (!isRepay && !cardNo) return;
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
          cardNo: parseInt(cardNo),
          borrowed: parseFloat(borrowed),
          startDate,
          payments: [],
        },
      };
      if (mobileNo && mobileNo.trim() !== "") newBorrower.mobileNo = mobileNo;
      if (location && location.trim() !== "") newBorrower.location = location;
      if (onAdd) {
        await onAdd(newBorrower);
      }

      // Optimize: Use lineId directly from params
      if (lineId) {
        const lineRef = firestoreDoc(db, "lines", lineId);
        const lineSnap = await getDoc(lineRef);
        if (lineSnap.exists()) {
          const lineData = lineSnap.data();
          const days = lineData.days || {};
          const prevDay = days[day] || { sessions: [], startDate: null };
          if (!onRepay && !prevDay.startDate) {
            const newDays = { ...days, [day]: { ...prevDay, startDate } };
            await updateDoc(lineRef, { days: newDays });
          }
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
        <h2 className="text-xl font-bold text-yellow-500 mb-4">{isRepay ? "Repay & Renew Loan" : "Add New Borrower"}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isRepay && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Card Number
              </label>
              <input
                type="number"
                value={cardNo}
                onChange={(e) => setCardNo(e.target.value)}
                className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Enter card number"
                required
                pattern="[0-9]*"
                inputMode="numeric"
                autoFocus={true}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Borrower Name
            </label>
            <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="Enter borrower name"
            required
            autoFocus={!isRepay ? false : true}
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
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
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
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="Enter location"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number (optional)</label>
            <input
              type="tel"
              value={mobileNo}
              onChange={e => setMobileNo(e.target.value)}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
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
              className="px-4 py-2 rounded bg-yellow-400 text-black hover:bg-yellow-500 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? (isRepay ? "Renewing..." : "Adding...") : (isRepay ? "Repay & Renew" : "Add Borrower")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBorrowerPopUp;
