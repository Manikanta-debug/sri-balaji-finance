import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DualCircleLoader from "../components/DualCircleLoader";
import SimpleLoader from "../components/SimpleLoader";
import { formatDateForDisplay, getLocalDateInputValue } from "../utils/date";
import useDashboardData from "../hooks/useDashboardData";
import formatToInr from "../utils/formatToInr";

const Dashboard = () => {
  const { lineId } = useParams();
  const navigate = useNavigate();
  const [filterDate, setFilterDate] = useState(getLocalDateInputValue());

  const { collectionLoading, data, lineName, loading } = useDashboardData(
    lineId,
    filterDate,
    navigate
  );

  const formattedFilterDate = useMemo(() => {
    if (!filterDate) return null;
    return formatDateForDisplay(filterDate);
  }, [filterDate]);

  const insights = useMemo(() => {
    return {
      totalBorrowed: data.lineStats?.totalBorrowed || 0,
      totalRepaid: data.lineStats?.totalRepaid || 0,
      totalBalance:
        (data.lineStats?.totalBorrowed || 0) -
        (data.lineStats?.totalRepaid || 0),
      totalBorrowers: data.lineStats?.totalBorrowers || 0,
      daily: data.dailyStats,
      villageStats: data.villageStats || [],
    };
  }, [data]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <DualCircleLoader />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-2 md:gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-yellow-500 font-medium flex items-center gap-1 cursor-pointer"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-800">
          {(lineName || "").toUpperCase()} Dashboard
        </h1>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-1">
            Total Lifetime Investment
          </p>
          <p className="text-2xl font-bold text-gray-800">
            {formatToInr(insights.totalBorrowed)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-1">
            Total Lifetime Collection
          </p>
          <p className="text-2xl font-bold text-yellow-500">
            {formatToInr(insights.totalRepaid)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-1">
            Total Lifetime Balance
          </p>
          <p className="text-2xl font-bold text-rose-600">
            {formatToInr(insights.totalBalance)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-1">
            Total Borrowers
          </p>
          <p className="text-2xl font-bold text-blue-600">
            {insights.totalBorrowers.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-8">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            Daily Summary:
            <span className="ml-2 hidden md:inline-block">
              {formattedFilterDate}
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <label className="hidden text-sm font-medium text-gray-600 md:block">
              Filter by Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative min-h-[140px] flex flex-col justify-center">
            <p className="text-sm font-bold text-yellow-600 uppercase tracking-wider mb-3">
              Morning Session
            </p>
            {collectionLoading ? (
              <SimpleLoader />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Investment:</span>
                  <span className="font-bold text-gray-800">
                    {formatToInr(insights.daily.morning?.borrowed || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collection:</span>
                  <span className="font-bold text-blue-600">
                    {formatToInr(insights.daily.morning?.repaid || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative min-h-[140px] flex flex-col justify-center">
            <p className="text-sm font-bold text-yellow-600 uppercase tracking-wider mb-3">
              Afternoon Session
            </p>
            {collectionLoading ? (
              <SimpleLoader />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Investment:</span>
                  <span className="font-bold text-gray-800">
                    {formatToInr(insights.daily.afternoon?.borrowed || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collection:</span>
                  <span className="font-bold text-blue-600">
                    {formatToInr(insights.daily.afternoon?.repaid || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-yellow-400 p-5 rounded-2xl shadow-md relative min-h-[140px] flex flex-col justify-center">
            <p className="text-sm font-bold text-black uppercase tracking-wider mb-3">
              Day Total
            </p>
            {collectionLoading ? (
              <SimpleLoader />
            ) : (
              <div className="space-y-2 text-black">
                <div className="flex justify-between">
                  <span className="font-medium">Total Investment:</span>
                  <span className="font-bold">
                    {formatToInr(insights.daily.totalBorrowed || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Collection:</span>
                  <span className="font-bold text-blue-800">
                    {formatToInr(insights.daily.totalRepaid || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            Village Wise Summary
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Village
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Day
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Session
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-center">
                  Borrowers
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Investment
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Collection
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insights.villageStats.map((v) => (
                <tr key={v.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {v.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {v.day?.charAt(0).toUpperCase() + v.day?.slice(1)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {v.session?.charAt(0).toUpperCase() + v.session?.slice(1)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-center">
                    {v.borrowers}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatToInr(v.borrowed)}
                  </td>
                  <td className="px-6 py-4 text-yellow-500">
                    {formatToInr(v.repaid)}
                  </td>
                  <td className="px-6 py-4 text-rose-600">
                    {formatToInr(v.borrowed - v.repaid)}
                  </td>
                </tr>
              ))}
              {insights.villageStats.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    No data available for this line
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
