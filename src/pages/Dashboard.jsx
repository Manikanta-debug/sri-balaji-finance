import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import DualCircleLoader from "../components/DualCircleLoader";
import SimpleLoader from "../components/SimpleLoader";

const Dashboard = () => {
    const { lineId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [collectionLoading, setCollectionLoading] = useState(false);
    const [lineName, setLineName] = useState("");
    const [data, setData] = useState({
        lineStats: { totalBorrowed: 0, totalRepaid: 0, totalBorrowers: 0 },
        villageStats: [],
        dailyStats: {
            morning: { borrowed: 0, repaid: 0 },
            afternoon: { borrowed: 0, repaid: 0 },
            totalBorrowed: 0,
            totalRepaid: 0
        }
    });
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); 

    // 1. Initial load for Line and Village metadata
    useEffect(() => {
        const fetchBaseData = async () => {
            setLoading(true);
            try {
                const lineRef = doc(db, "lines", lineId);
                const lineSnap = await getDoc(lineRef);
                if (!lineSnap.exists()) {
                    alert("Line not found");
                    navigate("/");
                    return;
                }
                const lineData = lineSnap.data();
                setLineName(lineData.line);
                const lineStats = lineData.stats || { totalBorrowed: 0, totalRepaid: 0, totalBorrowers: 0 };

                const days = lineData.days || {};
                let villageStatsMap = {};

                const queryPromises = [];
                for (const dKey in days) {
                    const sessions = days[dKey].sessions || [];
                    for (const session of sessions) {
                        const sessionDocId = `${lineId}_${dKey}_${session}`;
                        const villagesCol = collection(db, "lines", sessionDocId, "villages");
                        queryPromises.push(
                            getDocs(villagesCol)
                        );
                    }
                }

                const results = await Promise.all(queryPromises);
                for (const villagesSnap of results) {
                    for (const vDoc of villagesSnap.docs) {
                        const vData = vDoc.data();
                        const vStats = vData.stats || { totalBorrowed: 0, totalRepaid: 0, totalBorrowers: 0 };
                        
                        if (!villageStatsMap[vData.name]) {
                            villageStatsMap[vData.name] = { borrowed: 0, repaid: 0, borrowers: 0 };
                        }
                        villageStatsMap[vData.name].borrowed += (vStats.totalBorrowed || 0);
                        villageStatsMap[vData.name].repaid += (vStats.totalRepaid || 0);
                        villageStatsMap[vData.name].borrowers += (vStats.totalBorrowers || 0);
                    }
                }

                setData(prev => ({
                    ...prev,
                    lineStats,
                    villageStats: Object.entries(villageStatsMap).map(([name, stats]) => ({ name, ...stats })),
                }));
            } catch (error) {
                console.error("Error fetching dashboard base data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (lineId) fetchBaseData();
    }, [lineId, navigate]);

    // 2. Separate update for Daily Stats when date changes
    useEffect(() => {
        const fetchDailyStats = async () => {
            if (!filterDate || !lineId) return;
            setCollectionLoading(true);
            try {
                const dailyRef = doc(db, "lines", lineId, "dailyStats", filterDate);
                const dailySnap = await getDoc(dailyRef);
                const stats = dailySnap.exists() ? dailySnap.data() : {
                    morning: { borrowed: 0, repaid: 0 },
                    afternoon: { borrowed: 0, repaid: 0 },
                    totalBorrowed: 0,
                    totalRepaid: 0
                };
                
                setData(prev => ({
                    ...prev,
                    dailyStats: stats
                }));
            } catch (error) {
                console.error("Error fetching daily stats:", error);
            } finally {
                setCollectionLoading(false);
            }
        };

        fetchDailyStats();
    }, [lineId, filterDate]);

    // Format date for display (dd/mm/yyyy)
    const formattedFilterDate = useMemo(() => {
        if (!filterDate) return null;
        const [y, m, d] = filterDate.split("-");
        return `${d}/${m}/${y}`;
    }, [filterDate]);

    const insights = useMemo(() => {
        return {
            totalBorrowed: data.lineStats?.totalBorrowed || 0,
            totalRepaid: data.lineStats?.totalRepaid || 0,
            totalBalance: (data.lineStats?.totalBorrowed || 0) - (data.lineStats?.totalRepaid || 0),
            totalBorrowers: data.lineStats?.totalBorrowers || 0,
            daily: data.dailyStats,
            villageStats: data.villageStats || []
        };
    }, [data]);

    if (loading) return <div className="h-screen flex items-center justify-center"><DualCircleLoader /></div>;

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button onClick={() => navigate(-1)} className="text-yellow-500 font-medium mb-2 flex items-center gap-1 cursor-pointer">
                        ← Back
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800">{(lineName || "").toUpperCase()} Dashboard</h1>
                </div>
                
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-600">Filter by Date</label>
                    <input 
                        type="date" 
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
                    />
                </div>
            </div>

            {/* Lifetime Stat Cards */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">Total Borrowed (Lifetime)</p>
                    <p className="text-2xl font-bold text-gray-800">₹{insights.totalBorrowed.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">Total Repaid (Lifetime)</p>
                    <p className="text-2xl font-bold text-yellow-500">₹{insights.totalRepaid.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-rose-600">₹{insights.totalBalance.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">Total Handling</p>
                    <p className="text-2xl font-bold text-blue-600">{insights.totalBorrowers.toLocaleString()} Borrowers</p>
                </div>
            </div>

            {/* Daily Session Breakdown */}
            <div className="max-w-6xl mx-auto mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Daily Summary: {formattedFilterDate}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Morning Session */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative min-h-[140px] flex flex-col justify-center">
                        <p className="text-sm font-bold text-yellow-600 uppercase tracking-wider mb-3">Morning Session</p>
                        {collectionLoading ? (
                             <SimpleLoader />
                        ) : (
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Given (Loans):</span>
                                    <span className="font-bold text-gray-800">₹{(insights.daily.morning?.borrowed || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Collected:</span>
                                    <span className="font-bold text-blue-600">₹{(insights.daily.morning?.repaid || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Afternoon Session */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative min-h-[140px] flex flex-col justify-center">
                        <p className="text-sm font-bold text-yellow-600 uppercase tracking-wider mb-3">Afternoon Session</p>
                        {collectionLoading ? (
                             <SimpleLoader />
                        ) : (
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Given (Loans):</span>
                                    <span className="font-bold text-gray-800">₹{(insights.daily.afternoon?.borrowed || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Collected:</span>
                                    <span className="font-bold text-blue-600">₹{(insights.daily.afternoon?.repaid || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Day Total */}
                    <div className="bg-yellow-400 p-5 rounded-2xl shadow-md relative min-h-[140px] flex flex-col justify-center">
                        <p className="text-sm font-bold text-black uppercase tracking-wider mb-3">Day Total</p>
                        {collectionLoading ? (
                             <SimpleLoader />
                        ) : (
                            <div className="space-y-2 text-black">
                                <div className="flex justify-between">
                                    <span className="font-medium">Total Given:</span>
                                    <span className="font-bold">₹{(insights.daily.totalBorrowed || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Total Collected:</span>
                                    <span className="font-bold text-blue-800">₹{(insights.daily.totalRepaid || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Village Breakdown */}
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">Village Wise Summary</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Village</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-center">Borrowers</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Borrowed</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Repaid</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {insights.villageStats.map((v) => (
                                <tr key={v.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-800">{v.name}</td>
                                    <td className="px-6 py-4 text-gray-600 text-center">{v.borrowers}</td>
                                    <td className="px-6 py-4 text-gray-600">₹{v.borrowed.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-yellow-500">₹{v.repaid.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-rose-600">₹{(v.borrowed - v.repaid).toLocaleString()}</td>
                                </tr>
                            ))}
                            {insights.villageStats.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">No data available for this line</td>
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