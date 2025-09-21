import { useState } from "react";
const BorrowerDetailsPopUp=({borrower, onClose, onDelete})=>{
  const [showConfirm, setShowConfirm] = useState(false);
  const loan = borrower.loan;

  const handleDelete = () => setShowConfirm(true);
  const handleConfirmDelete = () => {
    setShowConfirm(false);
    if (onDelete) onDelete();
  };
  const handleCancelDelete = () => setShowConfirm(false);

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        <h2 className="text-xl font-bold text-emerald-700 mb-4">
          {loan.cardNo}. {borrower.name.toUpperCase()}
        </h2>
        <div className="space-y-3">
          <div className="p-3 border rounded bg-emerald-50">
            <p>Start date: {loan.startDate.split("-").reverse().join("/")}</p>
            <p>Total amount: {loan.borrowed}</p>
            <p>
              Total Repaid: {loan.payments.reduce((sum, p) => sum + p.amount, 0)}
            </p>
            <p>
              Balance: {loan.borrowed - loan.payments.reduce((sum, p) => sum + p.amount, 0)}
            </p>
            {borrower.mobileNo && (
              <p>
                Mobile: {borrower.mobileNo} {" "}
                <a
                  href={`tel:${borrower.mobileNo}`}
                  className="inline-block ml-2 px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  title="Call"
                >
                  Call
                </a>
              </p>
            )}
            {borrower.location && (
              <p>Location: {borrower.location}</p>
            )}
            <div className="mt-2">
              <h4 className="font-medium">Payments:</h4>
              <ul className="list-disc ml-5">
                {loan.payments.map((p, i) => (
                  <li key={i}>
                    {p.date}: {p.amount}
                    {p.amount === 0 && (
                      <span className="text-red-500"> (Missed)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Close
          </button>
        </div>
        {showConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-transparent bg-opacity-30">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm flex flex-col items-center">
              <p className="mb-4 text-lg font-semibold text-gray-800">Are you sure you want to delete this borrower?</p>
              <div className="flex justify-between w-full">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default BorrowerDetailsPopUp;