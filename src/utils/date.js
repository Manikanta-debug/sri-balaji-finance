export const toStorageDate = (value) => {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return value;
};

export const formatDateForDisplay = (value) => {
  const storageDate = toStorageDate(value);
  const match = storageDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value || "";
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

export const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createWeeklyDateSeries = (startDateStr, page = 1, count = 5) => {
  let baseDate;
  const normalizedStart = toStorageDate(startDateStr);

  if (normalizedStart) {
    const [year, month, day] = normalizedStart.split("-").map(Number);
    baseDate = new Date(year, month - 1, day);
  } else {
    baseDate = new Date();
  }

  const offset = (page - 1) * count * 7;
  baseDate.setDate(baseDate.getDate() + offset);

  return Array.from({ length: count }, (_, index) => {
    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + index * 7);
    return getLocalDateInputValue(currentDate);
  });
};

export const normalizeBorrowerRecord = (borrower) => {
  if (!borrower) return borrower;

  const loan = borrower.loan || {};
  const payments = Array.isArray(loan.payments)
    ? loan.payments.map((payment) => ({
        ...payment,
        date: toStorageDate(payment.date),
      }))
    : [];

  return {
    ...borrower,
    loan: {
      ...loan,
      startDate: toStorageDate(loan.startDate),
      payments,
    },
  };
};
