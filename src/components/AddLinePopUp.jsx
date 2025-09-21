import { useState } from "react";
import SimpleLoader from "../components/SimpleLoader"
const AddLinePopUp = ({ loading, onSubmit, days, sessions, setIsModalOpen, addMode }) => {
  const defaultForm = {
    line: "",
    day: days[0],
    session: sessions[0],
    password: "",
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
          className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
          required
        />
        <input
          type="password"
          placeholder="Set password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 mt-2"
          required
        />
      </>
    );
  } else if (addMode === "day") {
    title = "Add Day";
    inputField = (
      <select
        value={formData.day}
        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
        className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    );
  } else if (addMode === "session") {
    title = "Add Session";
    inputField = (
      <select
        value={formData.session}
        onChange={(e) => setFormData({ ...formData, session: e.target.value })}
        className="outline-none border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
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
        <h2 className="text-xl font-bold text-emerald-700 mb-4">{title}</h2>
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
                loading
              }
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
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
