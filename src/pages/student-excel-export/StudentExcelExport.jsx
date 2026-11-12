import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiDownload, FiEdit3, FiFileText, FiRefreshCw } from "react-icons/fi";
import { SCHOOL_CLASSES } from "../../academicConfig";
import { downloadIdCardWorkbook } from "../../utils/studentExcel";
import "./StudentExcelExport.css";

export default function StudentExcelExport() {
  const academicSession = localStorage.getItem("activeSession") || "";
  const [studentClass, setStudentClass] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStudents = useCallback(async () => {
    if (!/^\d{4}-\d{4}$/.test(academicSession)) {
      setNotice("Select a valid academic session first.");
      setStudents([]);
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const { data } = await axios.get("http://localhost:3000/all-students", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { academicSession, studentClass, search: "" },
      });
      setStudents(data || []);
      setNotice(`${data?.length || 0} students are ready.`);
    } catch (error) {
      setStudents([]);
      setNotice(error.response?.data?.message || "Could not load student data.");
    } finally {
      setLoading(false);
    }
  }, [academicSession, studentClass]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const download = async () => {
    if (!students.length) return setNotice("No student data is available to download.");
    const classPart = studentClass ? `-${studentClass}` : "-all-classes";
    downloadIdCardWorkbook(students, academicSession, `id-card-students-${academicSession}${classPart}.xlsx`);
    setNotice("Styled editable Excel file downloaded. Edit it and use Load Excel in ID Card Studio.");
  };

  return <main className="student-excel-page">
    <header className="student-excel-header">
      <div><span>STUDENT DATA WORKFLOW</span><h1>Student Excel Export</h1><p>Download the MongoDB roster, edit it in Excel and import it into ID Card Studio.</p></div>
      <div className="student-excel-count"><strong>{students.length}</strong><span>Students</span></div>
    </header>

    <section className="student-excel-card">
      <div className="student-excel-steps">
        <div><FiDownload /><strong>1. Download</strong><span>MongoDB student data</span></div>
        <div><FiEdit3 /><strong>2. Edit</strong><span>Required details in Excel</span></div>
        <div><FiFileText /><strong>3. Import</strong><span>In ID Card Studio</span></div>
      </div>
      <div className="student-excel-controls">
        <label>Academic session<input value={academicSession} readOnly /></label>
        <label>Class<select value={studentClass} onChange={(event) => setStudentClass(event.target.value)}><option value="">All classes</option>{SCHOOL_CLASSES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button type="button" className="excel-refresh" onClick={loadStudents} disabled={loading}><FiRefreshCw />{loading ? "Loading..." : "Refresh data"}</button>
        <button type="button" className="excel-download" onClick={download} disabled={loading || !students.length}><FiDownload />Download editable Excel</button>
        <Link className="excel-studio-link" to="/id-card-studio">Open ID Card Studio</Link>
      </div>
      {notice && <p className="student-excel-notice">{notice}</p>}
      <div className="student-excel-info"><strong>Important:</strong> <code>Admission_No</code> must remain unchanged. QR attendance and MongoDB student records match using this permanent number. Other details can be edited.</div>
    </section>
  </main>;
}
