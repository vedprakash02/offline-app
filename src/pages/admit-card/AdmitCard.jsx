import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiPrinter, FiFilter, FiAlertCircle, FiCheckCircle, FiUsers } from "react-icons/fi";
import { SCHOOL_CLASSES, STREAMS } from "../../academicConfig";
import "./AdmitCard.css";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function AdmitCard() {
  const activeSession = localStorage.getItem("activeSession") || "";
  const [filters, setFilters] = useState({ class: "", stream: "", examType: "" });
  const [students, setStudents] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const needsStream = ["11th", "12th"].includes(filters.class);

  useEffect(() => {
    loadSchoolProfile();
  }, []);

  const loadSchoolProfile = async () => {
    try {
      const response = await axios.get("http://localhost:3000/get-school-profile", { headers: headers() });
      setSchoolProfile(response.data);
    } catch (error) {
      console.error("School profile load nahi hua:", error);
    }
  };

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

  const printAdmitCards = () => {
    const orientation = "portrait";
    document.body.classList.add("admit-print-active");
    
    const finishPrinting = () => {
      document.body.classList.remove("admit-print-active");
      window.removeEventListener("afterprint", finishPrinting);
    };
    
    window.addEventListener("afterprint", finishPrinting);
    window.print();
  };

  return (
    <main className="admit-card-page">
      <header className="admit-card-header">
        <div className="admit-card-icon"><FiUsers /></div>
        <div>
          <span>EXAM ADMIT CARD</span>
          <h2>Generate Admit Cards</h2>
          <p>Class-wise admit cards generate karein for students</p>
        </div>
        <div className="admit-card-session">
          <span>Academic Session</span>
          <strong>{activeSession}</strong>
        </div>
      </header>

      {status && (
        <div className={`admit-card-alert ${status.type}`}>
          {status.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
          {status.text}
        </div>
      )}

      <section className="admit-card-toolbar">
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

      {students.length > 0 && (
        <section className="admit-card-actions">
          <button type="button" onClick={printAdmitCards} className="print-btn">
            <FiPrinter /> Print Admit Cards
          </button>
        </section>
      )}

      <section className="admit-card-grid">
        {students.length === 0 ? (
          <div className="admit-card-empty">
            <FiUsers />
            <strong>Class aur exam select karke admit cards generate karein</strong>
          </div>
        ) : (
          students.map((student, index) => (
            <div key={student._id || index} className="admit-card">
              <div className="admit-card-header">
                <h3>ADMIT CARD</h3>
                <p>{filters.examType} Examination - {activeSession}</p>
              </div>
              
              {schoolProfile && (
                <div className="admit-card-school">
                  <h4>{schoolProfile.schoolName || "School Name"}</h4>
                  <p>{schoolProfile.address || "School Address"}</p>
                </div>
              )}

              <div className="admit-card-student">
                <div className="student-photo">
                  {student.imageUrl ? (
                    <img src={student.imageUrl} alt={`${student.name}`} />
                  ) : (
                    <div className="photo-placeholder">Photo</div>
                  )}
                </div>
                <div className="student-details">
                  <p><strong>Name:</strong> {student.name}</p>
                  <p><strong>Roll No:</strong> {student.rollNo || "—"}</p>
                  <p><strong>Admission No:</strong> {student.admissionNo || "—"}</p>
                  <p><strong>Class:</strong> {filters.class}{filters.stream ? ` - ${filters.stream}` : ""}</p>
                  <p><strong>Father's Name:</strong> {student.fatherName || "—"}</p>
                </div>
              </div>

              <div className="admit-card-footer">
                <div className="exam-details">
                  <p><strong>Exam:</strong> {filters.examType}</p>
                  <p><strong>Session:</strong> {activeSession}</p>
                </div>
                <div className="signature-section">
                  <div className="signature">
                    <p>Principal Signature</p>
                    <div className="signature-line"></div>
                  </div>
                  <div className="signature">
                    <p>Student Signature</p>
                    <div className="signature-line"></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}