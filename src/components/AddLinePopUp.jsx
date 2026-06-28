import { useState } from "react";
import SimpleLoader from "../components/SimpleLoader"
import { getLocalDateInputValue } from "../utils/date";
const AddLinePopUp = ({ loading, onSubmit, days, sessions, setIsModalOpen, addMode }) => {
  const todayStr = getLocalDateInputValue();
  const defaultForm = {
    line: "",
    day: days[0],
    session: sessions[0],
    password: "",
    startDate: todayStr,
  }
  const [formData, setFormData] = useState(defaultForm);
  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
    setIsModalOpen(false);
    setFormData(defaultForm);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setFormData(defaultForm);
  };

  let title = "";
  let inputField = null;

  if (addMode === "line") {
    title = "Add Line";
    inputField = (
    <>
    <input
    type="text"
    placeholder="Line name"
    value={formData.line}
    onChange={(e) => setFormData({ ...formData, line: e.target.value })}
    className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400"
    required
    />
    <input
    type="password"
    placeholder="Set password"
    value={formData.password}
    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
    className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 mt-2"
    required
    />
    </>
    );
    } else if (addMode === "village") {
    title = "Add Village";
    inputField = (
    <input
    type="text"
    placeholder="Village name"
    value={formData.village || ""}
    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
    className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400"
    required
    />
    );
    } else if (addMode === "day") {
    title = "Add Day";
    inputField = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Select Day</label>
        <select
        value={formData.day}
        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
        className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 w-full"
        >
        {days.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
        ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Start Date</label>
        <input
        type="date"
        value={formData.startDate}
        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 w-full bg-white"
        required
        />
      </div>
    </div>
    );
    } else if (addMode === "session") {
    title = "Add Session";
    inputField = (
    <select
    value={formData.session}
    onChange={(e) => setFormData({ ...formData, session: e.target.value })}
    className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-yellow-400"
    >
    {sessions.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
    ))}
    </select>
    );
    }

    return (
    <div className="fixed inset-0 bg-transparent bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
    <h2 className="text-xl font-bold text-yellow-500 mb-4">{title}</h2>
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    {inputField}
    <div className="flex justify-between gap-3 mt-4">
      <button
        type="button"
        onClick={handleCancel}
        className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={
          (addMode === "line" && (!formData.line || !formData.password)) ||
          (addMode === "day" && !formData.day) ||
          (addMode === "session" && !formData.session) ||
          (addMode === "village" && !formData.village) ||
          loading
        }
        className="px-4 py-2 rounded bg-yellow-400 text-black hover:bg-yellow-500 disabled:opacity-50"
      >
              {loading ? <SimpleLoader/> : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLinePopUp;
