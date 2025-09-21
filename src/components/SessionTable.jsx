const SessionTable=({last5Weeks, borrowers, setSelectedBorrower, setEditingBorrower, setRepayBorrower, totals})=>{
  return (
      <div className="w-screen h-screen flex flex-col bg-white flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-emerald-100 sticky top-0 z-10">
            <tr>
              <th className="border px-3 py-2 text-left">Card No</th>
              <th className="border px-3 py-2 text-left">Name</th>
              <th className="border px-3 py-2 text-right">Borrowed</th>
              <th className="border px-3 py-2 text-right">Repaid</th>
              <th className="border px-3 py-2 text-right">Balance</th>
              <th className="border px-3 py-2 text-center">Action</th>
              {last5Weeks.map((date) => (
                <th key={date} className="border px-3 py-2 text-right">
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {borrowers.map((b) => {
              const loan = b.loan;
              if (!loan) return null;

              const totalRepaid = loan.payments.reduce(
                (sum, p) => sum + p.amount,
                0
              );
              const balance = loan.borrowed - totalRepaid;

              return (
                <tr key={b.id} className="hover:bg-emerald-50">
                  <td
                    className="border border-black px-3 py-2 cursor-pointer text-emerald-700 hover:underline"
                    onClick={() => setSelectedBorrower(b)}
                  >
                    {loan.cardNo}
                  </td>
                  <td
                    className="border border-black px-3 py-2 cursor-pointer text-emerald-700 hover:underline"
                    onClick={() => setSelectedBorrower(b)}
                  >
                    {b.name}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {loan.borrowed}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {totalRepaid}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {balance}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {balance === 0 ? (
                      <button
                        onClick={() => setRepayBorrower(b)}
                        className="text-sm px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        Repay
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingBorrower(b)}
                        className="text-sm px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                  {last5Weeks.map((date) => {
                    const payment = loan.payments.find((p) => p.date === date);
                    return (
                      <td key={date} className="border px-3 py-2 text-right">
                        {payment ? payment.amount : "X"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 font-semibold sticky bottom-0 z-10">
            <tr>
              <td className="border px-3 py-2" colSpan={2}>
                Totals
              </td>
              <td className="border px-3 py-2 text-right">
                {totals.borrowed}
              </td>
              <td className="border px-3 py-2 text-right">{totals.repaid}</td>
              <td className="border px-3 py-2 text-right">
                {totals.borrowed - totals.repaid}
              </td>
              <td className="border px-3 py-2 text-center">—</td>
              {totals.payments.map((p, idx) => (
                <td key={idx} className="border px-3 py-2 text-right">
                  {p}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
  );
}
export default SessionTable;