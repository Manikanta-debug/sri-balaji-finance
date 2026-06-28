export const formatToInr = (value) => {
  return value?.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0});
};

export default formatToInr;
