import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiChevronRight, FiSearch, FiUsers } from "react-icons/fi";
import { SCHOOL_CLASSES } from "../../academicConfig";
import "./StudentList.css";

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const { data } = await axios.get("http://localhost:3000/all-students", { signal: controller.signal, headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, params: { search, studentClass, academicSession: localStorage.getItem("activeSession") } });
        setStudents(data);
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") setError(requestError.response?.data?.message || "Could not load the student list.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, studentClass]);

  return <main className="student-directory">
    <header className="directory-header"><div><span>STUDENT MANAGEMENT</span><h1>All students</h1><p>Click a student name to view the complete profile.</p></div><div className="directory-count"><FiUsers /><strong>{students.length}</strong><span>Students</span></div></header>
    <section className="directory-card"><div className="directory-filters"><label><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, admission number or phone" /></label><select value={studentClass} onChange={(e) => setStudentClass(e.target.value)}><option value="">All classes</option>{SCHOOL_CLASSES.map((item) => <option key={item}>{item}</option>)}</select></div>
      {error ? <div className="directory-state error">{error}</div> : loading ? <div className="directory-state">Loading students...</div> : students.length ? <div className="directory-table-wrap"><table><thead><tr><th className="student-serial">S.No.</th><th>Student name</th><th>Father's name</th><th>Class</th><th aria-label="Open profile" /></tr></thead><tbody>{students.map((student, index) => <tr key={student._id}><td className="student-serial">{index + 1}</td><td><Link className="student-name-link" to={`/dashboard/student/${student._id}`}><span className="student-avatar">{student.name?.trim()?.charAt(0)?.toUpperCase() || "S"}</span><strong>{student.name}</strong></Link></td><td>{student.fatherName}</td><td><span className="class-chip">{student.class}{student.stream ? ` · ${student.stream}` : ""}</span></td><td><Link className="open-student" aria-label={`Open ${student.name} profile`} to={`/dashboard/student/${student._id}`}><FiChevronRight /></Link></td></tr>)}</tbody></table></div> : <div className="directory-state"><FiUsers /><strong>No students found</strong><span>Try changing the search or class filter.</span></div>}
    </section>
  </main>;
}
