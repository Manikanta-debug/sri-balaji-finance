import { useReducer, useMemo, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy, query, getDoc, increment, setDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import BorrowerDetailsPopUp from "../components/BorrowerDetailsPopUp";
import EditPaymentPopUp from "../components/EditPaymentPopUp";
import AddBorrowerPopUp from "../components/AddBorrowerPopUp";
import SessionTable from "../components/SessionTable";
import DualCircleLoader from "../components/DualCircleLoader";
import AddLinePopUp from "../components/AddLinePopUp";


function getLast5Weeks(startDateStr, page = 1) {
    let baseDate;
    if (startDateStr) {
        const [year, month, day] = startDateStr.split("-").map(Number);
        baseDate = new Date(year, month - 1, day);
    } else {
        baseDate = new Date();
    }
    const offset = (page - 1) * 5 * 7;
    baseDate.setDate(baseDate.getDate() + offset);
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i * 7);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    });
}

export default function LineDaySession({ unlockedLines, setUnlockedLines }) {
    const { lineId, day, session, villageId } = useParams();
    const navigate = useNavigate();
    const [villages, setVillages] = useState([]);
    const [borrowers, setBorrowers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(null);
    const [lineName, setLineName] = useState("");

    const [page, setPage] = useState(1);
    const last5Weeks = getLast5Weeks(startDate, page);

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Memoize the selected village object
    const selectedVillage = useMemo(() => 
        villages.find(v => v.id === villageId), 
    [villages, villageId]);

    // Handle password check
    useEffect(() => {
        const checkAuth = async () => {
            if (lineId && !unlockedLines.includes(lineId)) {
                const lineRef = doc(db, "lines", lineId);
                const lineSnap = await getDoc(lineRef);
                if (lineSnap.exists()) {
                    const entry = lineSnap.data();
                    const userPwd = window.prompt(`Enter password for ${entry.line}:`);
                    if (userPwd === entry.password) {
                        setUnlockedLines(prev => [...prev, lineId]);
                        setLineName(entry.line);
                    } else {
                        alert("Incorrect password");
                        navigate("/");
                    }
                } else {
                    navigate("/");
                }
            }
        };
        checkAuth();
    }, [lineId, unlockedLines, navigate, setUnlockedLines]);

    useEffect(() => {
        const fetchLineInfoAndVillages = async () => {
            setLoading(true);
            try {
                // Fetch Line config
                const lineRef = doc(db, "lines", lineId);
                const lineSnap = await getDoc(lineRef);
                if (lineSnap.exists()) {
                    const lineData = lineSnap.data();
                    setLineName(lineData.line);
                    if (lineData.days && lineData.days[day]) {
                        setStartDate(lineData.days[day].startDate || null);
                    }
                }

                // Fetch Villages for this session
                const sessionDocId = `${lineId}_${day}_${session}`;
                const villagesCol = collection(db, "lines", sessionDocId, "villages");
                const snapshot = await getDocs(villagesCol);
                const villageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setVillages(villageData);
            } catch (error) {
                console.error("Error fetching villages:", error);
            } finally {
                setLoading(false);
            }
        };
        if (lineId && unlockedLines.includes(lineId)) fetchLineInfoAndVillages();
    }, [lineId, day, session, unlockedLines]);

    useEffect(() => {
        if (!villageId || !unlockedLines.includes(lineId)) {
            setBorrowers([]);
            return;
        }

        const fetchBorrowers = async () => {
            setLoading(true);
            try {
                const sessionDocId = `${lineId}_${day}_${session}`;
                const borrowersCol = query(
                    collection(db, "lines", sessionDocId, "villages", villageId, "borrowers"),
                    orderBy("loan.cardNo", "asc")
                );
                const snapshot = await getDocs(borrowersCol);
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                setBorrowers(data);
            } catch (error) {
                console.error("Error fetching borrowers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBorrowers();
    }, [villageId, lineId, day, session, unlockedLines]);

    const onAddVillage = async (data) => {
        const vName = data.village;
        if (!vName) return;

        setLoading(true);
        try {
            const sessionDocId = `${lineId}_${day}_${session}`;
            const villagesCol = collection(db, "lines", sessionDocId, "villages");
            const docRef = await addDoc(villagesCol, { name: vName });
            const newVillage = { id: docRef.id, name: vName };
            setVillages(prev => [...prev, newVillage]);
            setIsModalOpen(false);
            // Auto-navigate to the new village
            navigate(`/${lineId}/${day}/${session}/${docRef.id}`);
        } catch (error) {
            alert("Error adding village: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateMetadata = async (borrowedDiff, repaidDiff, countDiff, paymentDate = null, paymentAmountDiff = 0, loanDate = null, loanAmountDiff = 0) => {
        const sessionDocId = `${lineId}_${day}_${session}`;
        const paths = [
            doc(db, "lines", lineId),
            doc(db, "lines", sessionDocId),
            doc(db, "lines", sessionDocId, "villages", villageId)
        ];

        for (const p of paths) {
            await setDoc(p, {
                stats: {
                    totalBorrowed: increment(borrowedDiff),
                    totalRepaid: increment(repaidDiff),
                    totalBorrowers: increment(countDiff)
                }
            }, { merge: true });
        }

        // Daily Stats Tracking (Session-wise)
        if (loanDate && loanAmountDiff !== 0) {
            const dailyRef = doc(db, "lines", lineId, "dailyStats", loanDate);
            await setDoc(dailyRef, {
                [session]: {
                    borrowed: increment(loanAmountDiff)
                },
                totalBorrowed: increment(loanAmountDiff)
            }, { merge: true });
        }

        if (paymentDate && paymentAmountDiff !== 0) {
            // Convert dd/mm/yyyy to yyyy-mm-dd for consistent storage
            const [pd, pm, py] = paymentDate.split("/");
            const dateId = `${py}-${pm}-${pd}`;
            const dailyRef = doc(db, "lines", lineId, "dailyStats", dateId);
            await setDoc(dailyRef, {
                [session]: {
                    repaid: increment(paymentAmountDiff)
                },
                totalRepaid: increment(paymentAmountDiff)
            }, { merge: true });
        }
    };

    const addBorrower = async (newBorrower) => {
        if (!villageId) return;
        const allowedDates = last5Weeks.map(d => {
            const [day, month, year] = d.split("/");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        });
        if (!allowedDates.includes(newBorrower.loan.startDate)) {
            alert("Start date must be one of the current 5 dates shown in the table.");
            return;
        }
        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowersCol = collection(db, "lines", sessionDocId, "villages", villageId, "borrowers");
        const docRef = await addDoc(borrowersCol, newBorrower);
        
        // Update Metadata (including loanDate for dailyStats)
        await updateMetadata(newBorrower.loan.borrowed, 0, 1, null, 0, newBorrower.loan.startDate, newBorrower.loan.borrowed);
        
        setBorrowers(prev => [...prev, { ...newBorrower, id: docRef.id }]);
    };

    const updateBorrower = async (borrowerId, updatedData, isRenew = false) => {
        if (!villageId) return;
        
        const oldBorrower = borrowers.find(b => b.id === borrowerId);
        if (!oldBorrower) return;
        if (updatedData.loan && updatedData.loan.startDate) {
            if (!last5Weeks.includes(updatedData.selectedDate)) {
                alert("Start date must be one of the current 5 dates shown in the table.");
                return;
            }
        }
        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowerRef = doc(db, "lines", sessionDocId, "villages", villageId, "borrowers", borrowerId);
        const { id, ...dataToUpdate } = updatedData;
        console.log(updatedData)
        await updateDoc(borrowerRef, dataToUpdate);

        // Metadata Calculations
        let borrowedDiff = 0;
        let repaidDiff = 0;
        let paymentDate = null;
        let paymentAmountDiff = 0;
        let loanDate = null;
        let loanAmountDiff = 0;

        if (updatedData.loan) {
            if (isRenew) {
                // For Renew:
                // 1. Increment lifetime borrowed by the new borrowed amount
                borrowedDiff = updatedData.loan.borrowed || 0;
                loanDate = updatedData.loan.startDate;
                loanAmountDiff = borrowedDiff;
                // 2. Keep repaidDiff as 0 because the old repayments should stay in lifetime stats
                repaidDiff = 0;
            } else {
                // Check for Borrowed amount change (e.g. during manual edits)
                borrowedDiff = (updatedData.loan.borrowed || 0) - (oldBorrower.loan?.borrowed || 0);
                if (borrowedDiff !== 0) {
                    loanDate = updatedData.loan.startDate;
                    loanAmountDiff = borrowedDiff;
                }
                
                // Check for Payment changes
                const oldTotalRepaid = oldBorrower.loan?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const newTotalRepaid = updatedData.loan.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                repaidDiff = newTotalRepaid - oldTotalRepaid;

                if (updatedData.loan.payments) {
                    const changedPayment = updatedData.loan.payments.find((p, idx) => {
                        const oldP = oldBorrower.loan?.payments?.find(op => op.date === p.date);
                        return !oldP || oldP.amount !== p.amount;
                    });
                    if (changedPayment) {
                        paymentDate = changedPayment.date;
                        const oldP = oldBorrower.loan?.payments?.find(op => op.date === changedPayment.date);
                        paymentAmountDiff = changedPayment.amount - (oldP ? oldP.amount : 0);
                    }
                }
            }
        }

        if (borrowedDiff !== 0 || repaidDiff !== 0 || paymentAmountDiff !== 0 || loanAmountDiff !== 0) {
            await updateMetadata(borrowedDiff, repaidDiff, 0, paymentDate, paymentAmountDiff, loanDate, loanAmountDiff);
        }

        setBorrowers(prev => prev.map(b => b.id === borrowerId ? { ...b, ...dataToUpdate } : b));
    };

    const deleteBorrower = async (borrowerId) => {
        if (!villageId) return;
        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowerRef = doc(db, "lines", sessionDocId, "villages", villageId, "borrowers", borrowerId);
        await deleteDoc(borrowerRef);
        
        // Note: We DO NOT decrement totalBorrowed or totalRepaid because the user 
        // wants historical insights to stay forever.
        // We also keep totalBorrowers as a "Total ever handled" count.
        
        setBorrowers(prev => prev.filter(b => b.id !== borrowerId));
    };

    const [selectedBorrower, setSelectedBorrower] = useState(null);
    const [editingBorrower, setEditingBorrower] = useState(null);
    const [addingBorrower, setAddingBorrower] = useState(false);
    const [repayBorrower, setRepayBorrower] = useState(null);

    const totals = useMemo(() => {
        let borrowed = 0,
            repaid = 0,
            payments = Array(5).fill(0);

        borrowers.forEach((b) => {
            const loan = b.loan;
            if (!loan) return;

            borrowed += loan.borrowed;
            const totalRepaid = loan.payments?.reduce(
                (sum, p) => sum + p.amount,
                0
            ) || 0;
            repaid += totalRepaid;

            last5Weeks.forEach((date, idx) => {
                const p = loan.payments?.find((p) => p.date === date);
                payments[idx] += p ? p.amount : 0;
            });
        });

        return { borrowed, repaid, payments };
    }, [borrowers, last5Weeks]);


    const lastDate = last5Weeks[last5Weeks.length - 1];
    const [d, m, y] = lastDate.split("/").map(Number);
    const lastDateObj = new Date(y, m - 1, d);
    const filteredBorrowers = borrowers.filter(b => {
        const loan = b.loan;
        if (!loan || !loan.startDate) return false;
        const [sy, sm, sd] = loan.startDate.split("-").map(Number);
        const borrowerStartDate = new Date(sy, sm - 1, sd);
        return borrowerStartDate <= lastDateObj;
    });

    const handlePlusClick = () => {
        if (!selectedVillage) {
            setIsModalOpen(true);
        } else {
            setAddingBorrower(true);
        }
    }

    const isUnlocked = unlockedLines.includes(lineId);

    if (!isUnlocked && lineId) return <main className="min-h-screen bg-gray-50 flex items-center justify-center"><DualCircleLoader /></main>;

    if (!selectedVillage) {
        return (
            <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-500">
                        Sri Balaji Finance
                    </h1>
                    <p className="mt-2 text-gray-600">
                        {`Villages for ${lineName.toUpperCase()} on ${day.toUpperCase()} (${session.toUpperCase()})`}
                    </p>
                </div>

                {loading ? (
                    <DualCircleLoader />
                ) : (
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4">
                        <button
                            onClick={() => navigate(`/${lineId}/${day}`)}
                            className="self-start mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors cursor-pointer"
                        >
                            ← Back to Sessions
                        </button>
                        
                        {villages.length === 0 ? (
                            <h2 className="text-center text-gray-500 py-10">No villages found. Add a new village.</h2>
                        ) : (
                            villages.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => navigate(`/${lineId}/${day}/${session}/${v.id}`)}
                                    className="py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                                >
                                    {v.name.toUpperCase()}
                                </button>
                            ))
                        )}
                    </div>
                )}

                <button
                    onClick={handlePlusClick}
                    className="fixed right-5 bottom-5 w-14 h-14 rounded-full bg-white shadow-2xl shadow-yellow-400 flex items-center justify-center transition cursor-pointer"
                >
                    <img className="w-10 h-10" src={`${import.meta.env.BASE_URL}plus.svg`} alt="add-entry" />
                </button>

                {isModalOpen && (
                    <AddLinePopUp
                        loading={loading}
                        onSubmit={onAddVillage}
                        days={[]}
                        sessions={[]}
                        setIsModalOpen={setIsModalOpen}
                        addMode="village"
                    />
                )}
            </main>
        );
    }

    return (
        <div className="w-screen h-screen flex flex-col bg-white relative">
            <div className="sticky top-0 z-20 flex justify-between items-center p-2 md:p-4 bg-yellow-400 text-black shadow">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate(`/${lineId}/${day}/${session}`)}
                        className="px-2 py-1 cursor-pointer hover:bg-yellow-500 rounded transition-colors"
                    >
                        ←
                    </button>
                    <h1 className="text-lg font-semibold">
                        {lineName} • {day} • {session} • {selectedVillage.name}
                    </h1>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="px-3 py-1 rounded bg-yellow-500 text-black text-sm cursor-pointer"
                    >
                        Prev
                    </button>
                    <span className="text-sm font-medium hidden md:block">{page}</span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 rounded bg-yellow-500 text-black text-sm cursor-pointer"
                    >
                        Next
                    </button>
                    <button
                        onClick={handlePlusClick}
                        className="w-8 h-8 ml-2 bg-white rounded-full p-1 cursor-pointer"
                        aria-label="Add Borrower"
                    >
                        <img src={`${import.meta.env.BASE_URL}plus.svg`} alt="Add" className="w-full h-full" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <DualCircleLoader/>
                </div>
            ) : (
                <SessionTable last5Weeks={last5Weeks} borrowers={filteredBorrowers}
                    setSelectedBorrower={setSelectedBorrower} setEditingBorrower={setEditingBorrower}
                    setRepayBorrower={setRepayBorrower}
                    totals={totals} />
            )}

            {selectedBorrower && (
                <BorrowerDetailsPopUp
                    borrower={selectedBorrower}
                    onClose={() => setSelectedBorrower(null)}
                    onDelete={async () => {
                        await deleteBorrower(selectedBorrower.id);
                        setSelectedBorrower(null);
                    }}
                />
            )}
            {editingBorrower && (
                <EditPaymentPopUp
                    borrower={editingBorrower}
                    dispatch={(action) => {
                        if (action.type === "UPDATE_PAYMENT") {
                            setBorrowers(prev => prev.map(b => b.id === editingBorrower.id ? { ...b, loan: action.payload.loan } : b));
                            updateBorrower(editingBorrower.id, { loan: action.payload.loan, selectedDate:action.payload.selectedDate });
                        }
                    }}
                    onClose={() => setEditingBorrower(null)}
                    last5Weeks={last5Weeks}
                />
            )}
            {addingBorrower && (
                <AddBorrowerPopUp
                    newCardNo={borrowers[borrowers.length-1]?.loan.cardNo+1 || 1}
                    onAdd={async (newBorrower) => {
                        await addBorrower(newBorrower);
                        setAddingBorrower(false);
                    }}
                    onClose={() => setAddingBorrower(false)}
                />
            )}
            {repayBorrower && (
                <AddBorrowerPopUp
                    borrower={repayBorrower}
                    onRepay={async (updatedBorrower) => {
                        await updateBorrower(updatedBorrower.id, { loan: updatedBorrower.loan }, true);
                        setRepayBorrower(null);
                    }}
                    onClose={() => setRepayBorrower(null)}
                />
            )}
        </div>
    );
}
