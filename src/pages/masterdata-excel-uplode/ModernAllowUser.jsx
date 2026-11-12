import { useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { FiArrowLeft, FiCheckCircle, FiDownload, FiFileText, FiInfo, FiShield, FiUploadCloud, FiUsers, FiXCircle } from "react-icons/fi";
import "./ModernAllowUser.css";

const API = "http://localhost:3000";
const ROLES = ["admin", "principal", "teacher", "accountant", "operator", "student"];

export default function ModernAllowUser() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const selectFile = (selected) => {
    if (!selected) return;
    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      setStatus({ type: "error", text: "Select an .xlsx or .xls Excel file." });
      return;
    }
    setFile(selected);
    setStatus(null);
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const users = XLSX.utils.json_to_sheet([
      { username: "Ravi Kumar", email: "ravi.teacher@school.com", role: "teacher" },
    ], { header: ["username", "email", "role"] });
    users["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 16 }];
    const instructions = XLSX.utils.aoa_to_sheet([
      ["Master Users Upload Instructions"],
      ["Required columns", "username, email, role"],
      ["Allowed roles", ROLES.join(", ")],
      ["Teacher login", "Enter teacher exactly in the Role column"],
      ["Important", "Email must be unique and headers must remain unchanged."],
    ]);
    instructions["!cols"] = [{ wch: 22 }, { wch: 72 }];
    XLSX.utils.book_append_sheet(workbook, users, "Users");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
    XLSX.writeFile(workbook, "master-users-template.xlsx");
  };

  const upload = async () => {
    if (!file) return setStatus({ type: "error", text: "Select an Excel file first." });
    const formData = new FormData(); formData.append("file", file);
    setLoading(true); setStatus(null);
    try {
      const { data } = await axios.post(`${API}/upload-master-excel`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setStatus({ type: "success", text: data.message }); setFile(null); if (inputRef.current) inputRef.current.value = "";
    } catch (error) { setStatus({ type: "error", text: error.response?.data?.message || "Could not process the Excel file." }); }
    finally { setLoading(false); }
  };

  return <main className="master-users-page">
    <section className="master-hero">
      <button className="back-link" onClick={() => history.back()}><FiArrowLeft /> Dashboard</button>
      <div className="hero-copy"><div className="hero-icon"><FiShield /></div><div><span className="overline">ACCESS CONTROL</span><h1>Master Users</h1><p>Securely authorize teachers and staff who can sign up on the school portal.</p></div></div>
      <div className="hero-stat"><FiUsers /><div><strong>6</strong><span>Supported roles</span></div></div>
    </section>

    <div className="master-layout">
      <section className="upload-card">
        <div className="card-heading"><span className="step">01</span><div><h2>Download template</h2><p>A ready-to-use Excel file with the correct headers and a sample teacher record.</p></div></div>
        <button className="template-button" onClick={downloadTemplate}><span><FiFileText /><span><strong>Master users template</strong><small>.XLSX · Includes instructions</small></span></span><FiDownload /></button>
        <div className="divider"><span>then upload completed file</span></div>
        <div className="card-heading"><span className="step">02</span><div><h2>Upload user list</h2><p>Select the completed template to add users to the master list.</p></div></div>
        <div className={`drop-zone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={(e) => selectFile(e.target.files[0])} />
          <div className="upload-icon">{file ? <FiCheckCircle /> : <FiUploadCloud />}</div>
          {file ? <><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB · Ready to upload</span></> : <><strong>Drop Excel file here</strong><span>or click to browse · .xlsx and .xls supported</span></>}
        </div>
        {status && <div className={`upload-status ${status.type}`}>{status.type === "success" ? <FiCheckCircle /> : <FiXCircle />}<span>{status.text}</span></div>}
        <button className="upload-button" disabled={!file || loading} onClick={upload}>{loading ? <><span className="spinner" /> Processing users...</> : <><FiUploadCloud /> Upload Master Users</>}</button>
      </section>

      <aside className="guide-card"><div className="guide-title"><FiInfo /><div><h2>File requirements</h2><p>Check these points before uploading</p></div></div>
        <div className="columns"><span>Required columns</span>{["username", "email", "role"].map((column, index) => <div key={column}><b>{index + 1}</b><code>{column}</code>{column === "email" && <small>Must be unique</small>}</div>)}</div>
        <div className="role-guide"><span>Accepted role values</span><div>{ROLES.map((role) => <code className={role === "teacher" ? "featured" : ""} key={role}>{role}</code>)}</div></div>
        <div className="teacher-tip"><FiCheckCircle /><div><strong>Adding a teacher?</strong><p>In the Role column, enter exactly <code>teacher</code>. After uploading, the teacher can sign up with this email.</p></div></div>
      </aside>
    </div>
  </main>;
}
