import { useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, deleteDoc, increment, setDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import BorrowerDetailsPopUp from "../components/BorrowerDetailsPopUp";
import EditPaymentPopUp from "../components/EditPaymentPopUp";
import AddBorrowerPopUp from "../components/AddBorrowerPopUp";
import SessionTable from "../components/SessionTable";
import DualCircleLoader from "../components/DualCircleLoader";
import AddLinePopUp from "../components/AddLinePopUp";
import DeleteIconButton from "../components/DeleteIconButton";
import { deleteVillageCascade } from "../utils/firestoreCascadeDelete";
import { createWeeklyDateSeries, toStorageDate } from "../utils/date";
import useLineDaySessionData from "../hooks/useLineDaySessionData";
import { invalidateDashboardCache } from "../utils/dashboardCache";

export default function LineDaySession({ unlockedLines, setUnlockedLines }) {
    const { lineId, day, session, villageId } = useParams();
    const navigate = useNavigate();
    const {
        borrowers,
        loading,
        lineName,
        selectedVillage,
        setBorrowers,
        setLoading,
        setVillages,
        startDate,
        villages,
    } = useLineDaySessionData({
        lineId,
        day,
        session,
        villageId,
        unlockedLines,
        setUnlockedLines,
        navigate,
    });

    const [page, setPage] = useState(1);
    const last5Weeks = useMemo(() => createWeeklyDateSeries(startDate, page), [startDate, page]);
    const allowedDateSet = useMemo(() => new Set(last5Weeks), [last5Weeks]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingKey, setDeletingKey] = useState("");

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
            invalidateDashboardCache(lineId);
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
            const dailyRef = doc(db, "lines", lineId, "dailyStats", paymentDate);
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
        if (!allowedDateSet.has(newBorrower.loan.startDate)) {
            alert("Start date must be one of the current 5 dates shown in the table.");
            return;
        }
        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowersCol = collection(db, "lines", sessionDocId, "villages", villageId, "borrowers");
        const docRef = await addDoc(borrowersCol, newBorrower);
        
        // Update Metadata (including loanDate for dailyStats)
        await updateMetadata(newBorrower.loan.borrowed, 0, 1, null, 0, newBorrower.loan.startDate, newBorrower.loan.borrowed);
        
        setBorrowers(prev => [...prev, { ...newBorrower, id: docRef.id }]);
        invalidateDashboardCache(lineId);
    };

    const updateBorrower = async (borrowerId, updatedData, isRenew = false) => {
        if (!villageId) return;

        const oldBorrower = borrowers.find(b => b.id === borrowerId);
        if (!oldBorrower) return;
        if (updatedData.selectedDate && !allowedDateSet.has(updatedData.selectedDate)) {
            alert("Payment date must be one of the current 5 dates shown in the table.");
            return;
        }

        if (updatedData.loan?.startDate && !allowedDateSet.has(updatedData.loan.startDate)) {
            alert("Start date must be one of the current 5 dates shown in the table.");
            return;
        }

        const sessionDocId = `${lineId}_${day}_${session}`;
        const borrowerRef = doc(db, "lines", sessionDocId, "villages", villageId, "borrowers", borrowerId);
        const dataToUpdate = { ...updatedData };
        delete dataToUpdate.id;
        delete dataToUpdate.selectedDate;
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
                repaidDiff = 0;
            } else {
                borrowedDiff = (updatedData.loan.borrowed || 0) - (oldBorrower.loan?.borrowed || 0);
                if (borrowedDiff !== 0) {
                    loanDate = updatedData.loan.startDate;
                    loanAmountDiff = borrowedDiff;
                }

                const oldTotalRepaid = oldBorrower.loan?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const newTotalRepaid = updatedData.loan.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                repaidDiff = newTotalRepaid - oldTotalRepaid;

                if (updatedData.loan.payments) {
                    const changedPayment = updatedData.loan.payments.find((p) => {
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
        invalidateDashboardCache(lineId);
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
        invalidateDashboardCache(lineId);
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
    const filteredBorrowers = borrowers.filter(b => {
        const loan = b.loan;
        if (!loan?.startDate) return false;
        return toStorageDate(loan.startDate) <= lastDate;
    });

    const handlePlusClick = () => {
        if (!selectedVillage) {
            setIsModalOpen(true);
        } else {
            setAddingBorrower(true);
        }
    }

    const handleDeleteVillage = async (targetVillage) => {
        const confirmed = window.confirm(
            `Delete village "${targetVillage.name}"? This will permanently remove all borrowers in this village.`
        );
        if (!confirmed) return;

        const sessionDocId = `${lineId}_${day}_${session}`;
        setDeletingKey(`village:${targetVillage.id}`);
        try {
            await deleteVillageCascade(sessionDocId, targetVillage.id);
            setVillages((prev) => prev.filter((v) => v.id !== targetVillage.id));
            invalidateDashboardCache(lineId);
            if (villageId === targetVillage.id) {
                navigate(`/${lineId}/${day}/${session}`);
            }
        } catch (error) {
            alert(error?.message || `Failed to delete village "${targetVillage.name}".`);
        } finally {
            setDeletingKey("");
        }
    };

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
                                <div key={v.id} className="flex items-stretch gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/${lineId}/${day}/${session}/${v.id}`)}
                                        className="flex-1 py-3 px-4 bg-yellow-50 rounded-lg text-yellow-500 text-lg md:text-xl text-center font-medium hover:bg-yellow-400 hover:text-black transition-all duration-200 cursor-pointer"
                                    >
                                        {v.name.toUpperCase()}
                                    </button>
                                    <DeleteIconButton
                                        label={`Delete village ${v.name}`}
                                        disabled={deletingKey === `village:${v.id}`}
                                        onClick={() => handleDeleteVillage(v)}
                                    />
                                </div>
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
