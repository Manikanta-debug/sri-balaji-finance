import { useState } from "react";
import { db } from "../firebase";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditPaymentPopUp({ borrower, onClose, dispatch, last5Weeks }) {
  const { line, day, session } = useParams();
  const weeks = Array.isArray(last5Weeks) ? last5Weeks : [];
  const loan = borrower.loan || {};
  let startDateStr = "";
  if (loan.startDate) {
    const [y, m, d] = loan.startDate.split("-");
    startDateStr = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const today = new Date();
  let currentIdx = weeks.findIndex(dateStr => {
    const [d, m, y] = dateStr.split("/").map(Number);
    const weekDate = new Date(y, m - 1, d);
    return weekDate <= today;
  });
  if (currentIdx === -1) currentIdx = 0;
  let options = weeks;
  if (loan.startDate) {
    const [sy, sm, sd] = loan.startDate.split("-");
    const sDate = new Date(sy, sm - 1, sd);
    options = weeks.filter(dateStr => {
      const [od, om, oy] = dateStr.split("/");
      const oDate = new Date(oy, om - 1, od);
      return oDate > sDate;
    });
  }
  const [selectedDate, setSelectedDate] = useState(options[0] || "");
  const currentPayment = loan.payments?.find(p => p.date === selectedDate)?.amount || "";
  const [amount, setAmount] = useState(currentPayment);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0 || !selectedDate) return;
    const borrowerRef = doc(db, "lines", `${line}_${day}_${session}`, "borrowers", borrower.id);
    const borrowerSnap = await getDoc(borrowerRef);
    if (!borrowerSnap.exists()) return;
    const data = borrowerSnap.data();
    const loan = { ...(data.loan || {}) };
    let payments = Array.isArray(loan.payments) ? [...loan.payments] : [];
    const idx = payments.findIndex((p) => p.date === selectedDate);
    if (idx >= 0) {
      payments[idx] = { ...payments[idx], amount: parsed };
    } else {
      payments.push({ date: selectedDate, amount: parsed });
    }
    const updatedLoan = { ...loan, payments };
    await updateDoc(borrowerRef, { loan: updatedLoan });
    setAmount("");
    if (dispatch) {
      dispatch({ type: "UPDATE_PAYMENT", payload: { loan: updatedLoan } });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-bold text-emerald-700 mb-4">
          Update {borrower.name.toUpperCase()}
        </h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
          <select
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              const amt = loan.payments?.find(p => p.date === e.target.value)?.amount || "";
              setAmount(amt);
            }}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {options.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Enter amount"
            autoFocus={true}
          />
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) < 0}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
