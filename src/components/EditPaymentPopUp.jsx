import { useState } from "react";

export default function EditPaymentPopUp({ borrower, onClose, dispatch, last5Weeks }) {
  const weeks = Array.isArray(last5Weeks) ? last5Weeks : [];
  const loan = borrower.loan || {};
  
  // Calculate date options based on loan start date
  let options = weeks;
  if (loan.startDate) {
    const [sy, sm, sd] = loan.startDate.split("-");
    const sDate = new Date(sy, sm - 1, sd);
    options = weeks.filter(dateStr => {
      const [od, om, oy] = dateStr.split("/");
      const oDate = new Date(oy, om - 1, od);
      return oDate >= sDate; // Include start date or later
    });
  }

  const [selectedDate, setSelectedDate] = useState(options[0] || "");
  const currentPayment = loan.payments?.find(p => p.date === selectedDate)?.amount || "";
  const [amount, setAmount] = useState(currentPayment);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0 || !selectedDate) return;

    // Clone current payments and update or add the new one
    let payments = Array.isArray(loan.payments) ? [...loan.payments] : [];
    const idx = payments.findIndex((p) => p.date === selectedDate);
    
    if (idx >= 0) {
      payments[idx] = { ...payments[idx], amount: parsed };
    } else {
      payments.push({ date: selectedDate, amount: parsed });
    }

    const updatedLoan = { ...loan, payments };
    
    if (dispatch) {
      dispatch({ type: "UPDATE_PAYMENT", payload: { loan: updatedLoan } });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-bold text-yellow-500 mb-4">
          Update {borrower.name.toUpperCase()}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
            <select
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value);
                const amt = loan.payments?.find(p => p.date === e.target.value)?.amount || "";
                setAmount(amt);
              }}
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
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
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="Enter amount"
              autoFocus={true}
              required
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={amount === "" || parseFloat(amount) < 0}
              className="px-4 py-2 rounded bg-yellow-400 text-black hover:bg-yellow-500 disabled:opacity-70"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
