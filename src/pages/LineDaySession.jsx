import { useReducer, useMemo, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy, query } from "firebase/firestore";
import { useParams } from "react-router-dom";
import BorrowerDetailsPopUp from "../components/BorrowerDetailsPopUp";
import EditPaymentPopUp from "../components/EditPaymentPopUp";
import AddBorrowerPopUp from "../components/AddBorrowerPopUp";
import SessionTable from "../components/SessionTable";
import DualCircleLoader from "../components/DualCircleLoader";


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
        return d.toLocaleDateString("en-GB");
    });
}

export default function LineDaySession() {
    const { line, day, session } = useParams();
    const [borrowers, setBorrowers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(null);

    const [page, setPage] = useState(1);
    const last5Weeks = getLast5Weeks(startDate, page);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const linesCol = collection(db, "lines");
            const linesSnapshot = await getDocs(linesCol);
            let lineDoc = null;
            linesSnapshot.forEach(docSnap => {
                if (docSnap.data().line === line) lineDoc = docSnap.data();
            });
            let dayStartDate = null;
            if (lineDoc && lineDoc.days && lineDoc.days[day]) {
                dayStartDate = lineDoc.days[day].startDate || null;
            }
            setStartDate(dayStartDate);
            const borrowersCol = query(collection(db, "lines", `${line}_${day}_${session}`, "borrowers"), orderBy("loan.cardNo","asc"));
            const snapshot = await getDocs(borrowersCol);
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setBorrowers(data);
            setLoading(false);
        };
        fetchData();
    }, [line, day, session]);

    const addBorrower = async (newBorrower) => {
        const allowedDates = last5Weeks.map(d => {
            const [day, month, year] = d.split("/");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        });
        if (!allowedDates.includes(newBorrower.loan.startDate)) {
            alert("Start date must be one of the current 5 dates shown in the table.");
            return;
        }
        const borrowersCol = collection(db, "lines", `${line}_${day}_${session}`, "borrowers");
        const docRef = await addDoc(borrowersCol, newBorrower);
        setBorrowers(prev => [...prev, { ...newBorrower, id: docRef.id }]);
    };
    const updateBorrower = async (borrowerId, updatedData) => {
        // If updating loan.startDate, check if it's allowed
        if (updatedData.loan && updatedData.loan.startDate) {
            const allowedDates = last5Weeks.map(d => {
                const [day, month, year] = d.split("/");
                return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            });
            if (!allowedDates.includes(updatedData.loan.startDate)) {
                alert("Start date must be one of the current 5 dates shown in the table.");
                return;
            }
        }
        const borrowerRef = doc(db, "lines", `${line}_${day}_${session}`, "borrowers", borrowerId);
        await updateDoc(borrowerRef, updatedData);
        setBorrowers(prev => prev.map(b => b.id === borrowerId ? { ...b, ...updatedData } : b));
    };
    const deleteBorrower = async (borrowerId) => {
        const borrowerRef = doc(db, "lines", `${line}_${day}_${session}`, "borrowers", borrowerId);
        await deleteDoc(borrowerRef);
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

    return (
        <div className="w-screen h-screen flex flex-col bg-white relative">
            <div className="sticky top-0 z-20 flex justify-between items-center p-2 md:p-4 bg-emerald-700 text-white shadow">
                <h1 className="text-lg font-semibold hidden md:block">
                    {line.split("-")[1]} • {day} • {session}
                </h1>
                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                    >
                        Prev
                    </button>
                    <span className="text-sm font-medium hidden md:block">Page {page}</span>
                    <span className="text-sm font-medium md:hidden">{page}</span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setAddingBorrower(true)}
                        className="w-8 h-8 ml-4 bg-white rounded-full p-1 cursor-pointer"
                        aria-label="Add Borrower"
                    >
                        <img src={`${import.meta.env.BASE_URL}plus.svg`} alt="Add Borrower" className="w-full h-full" />
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
                            updateBorrower(editingBorrower.id, { loan: action.payload.loan });
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
                        await updateBorrower(updatedBorrower.id, { loan: updatedBorrower.loan });
                        setRepayBorrower(null);
                    }}
                    onClose={() => setRepayBorrower(null)}
                />
            )}
        </div>
    );
}
