import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiFilter, FiAlertCircle, FiCheckCircle, FiUsers, FiChevronRight } from "react-icons/fi";
import { SCHOOL_CLASSES, STREAMS } from "../../academicConfig";
import "./AdmitCardSelection.css";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function AdmitCardSelection({ onSelectStudent }) {
  const activeSession = localStorage.getItem("activeSession") || "";
  const [filters, setFilters] = useState({ class: "", stream: "", examType: "" });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const needsStream = ["11th", "12th"].includes(filters.class);

  const changeFilter = ({ target: { name, value } }) => {
    setFilters((current) => ({ ...current, [name]: value, ...(name === "class" ? { stream: "" } : {}) }));
    setStudents([]);
    setStatus(null);
  };

  const loadStudents = async () => {
    if (!filters.class) {
      return setStatus({ type: "error", text: "Pehle class select karein." });
    }
    if (needsStream && !filters.stream) {
      return setStatus({ type: "error", text: "11th/12th ke liye stream select karein." });
    }
    setLoading(true);
    setStatus(null);
    try {
      const capitalizedStream = filters.stream ? filters.stream.charAt(0).toUpperCase() + filters.stream.slice(1).toLowerCase() : '';
      const response = await axios.get(`http://localhost:3000/fetch-students/${filters.class}`, {
        headers: headers(),
        params: { academicYear: activeSession, ...(capitalizedStream ? { stream: capitalizedStream } : {}) }
      });
      setStudents(response.data.students || []);
      if (!response.data.students?.length) {
        setStatus({ type: "error", text: "Is class mein koi student nahi mila." });
      }
    } catch (error) {
      setStatus({ type: "error", text: error.response?.data?.message || "Students load nahi hue." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admit-card-selection-page">
      <header className="admit-card-selection-header">
        <div className="admit-card-selection-icon"><FiUsers /></div>
        <div>
          <span>EXAM ADMIT CARD - SELECTION</span>
          <h2>Select Class & Students</h2>
          <p>Class select karke students dekhein</p>
        </div>
        <div className="admit-card-selection-session">
          <span>Academic Session</span>
          <strong>{activeSession}</strong>
        </div>
      </header>

      {status && (
        <div className={`admit-card-selection-alert ${status.type}`}>
          {status.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
          {status.text}
        </div>
      )}

      <section className="admit-card-selection-toolbar">
        <label>
          <span>Class</span>
          <select name="class" value={filters.class} onChange={changeFilter}>
            <option value="">Select class</option>
            {SCHOOL_CLASSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Stream</span>
          <select name="stream" value={filters.stream} onChange={changeFilter} disabled={!needsStream}>
            <option value="">Select stream</option>
            {STREAMS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Exam Type</span>
          <select name="examType" value={filters.examType} onChange={changeFilter}>
            <option value="">Select exam</option>
            <option>Quarterly</option>
            <option>Half-Yearly</option>
            <option>Annual</option>
          </select>
        </label>
        <button type="button" onClick={loadStudents} disabled={loading}>
          <FiFilter />{loading ? "Loading..." : "Load Students"}
        </button>
      </section>

      <section className="admit-card-selection-list">
        {students.length === 0 ? (
          <div className="admit-card-selection-empty">
            <FiUsers />
            <strong>Class, exam select karke students load karein</strong>
          </div>
        ) : (
          <div className="students-table">
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student._id || index}>
                    <td>{student.rollNo || "—"}</td>
                    <td>{student.name}</td>
                    <td>{student.admissionNo || "—"}</td>
                    <td>{filters.class}{filters.stream ? ` - ${filters.stream}` : ""}</td>
                    <td>
                      <button
                        className="view-admit-btn"
                        onClick={() => onSelectStudent?.(student, filters)}
                      >
                        View Admit Card <FiChevronRight />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
