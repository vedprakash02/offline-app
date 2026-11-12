import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Html5Qrcode } from "html5-qrcode";
import { getStudentId, normalizeStudentId, readStudentIdFromQr } from "./attendanceQr";
import "./AttendancePage.css";

const storageKey = "id-card-attendance-records";
const todayKey = () => new Date().toLocaleDateString("en-CA");
const loadRecords = () => {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
  catch { return []; }
};

const AttendancePage = ({ students = [], onBack }) => {
  const [records, setRecords] = useState(loadRecords);
  const [message, setMessage] = useState("Start the camera and scan the QR code on the ID card.");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef(null);
  const qrPhotoInputRef = useRef(null);
  const lastScanRef = useRef({ value: "", time: 0 });

  const studentMap = useMemo(() => new Map(students.map((student, index) => [normalizeStudentId(getStudentId(student, index)), student])), [students]);
  const todayRecords = records.filter((record) => record.date === todayKey());

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(records)); }, [records]);
  useEffect(() => () => {
    if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {});
  }, []);

  const markAttendance = (rawValue) => {
    const studentId = normalizeStudentId(readStudentIdFromQr(rawValue) || rawValue);
    const student = studentMap.get(studentId);
    if (!student) { setMessage(`Student ID ${studentId || "blank"} was not found. This phone has ${students.length} students loaded; reload the correct Excel file.`); return; }
    const date = todayKey();
    const duplicate = records.some((record) => record.studentId === studentId && record.date === date);
    if (duplicate) { setMessage(`Attendance for ${student.name} has already been marked today.`); return; }
    const now = new Date();
    setRecords((current) => [...current, {
      studentId, name: student.name, className: student.className || "", date,
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: "Present",
    }]);
    setMessage(`Attendance marked: ${student.name}`);
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
      scannerRef.current?.clear();
    } catch { /* Scanner may already be stopped. */ }
    scannerRef.current = null;
    setScanning(false);
    setMessage("The camera is off. Tap Start camera scanner to scan again.");
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Open the application using an HTTPS URL to access the camera.");
      return;
    }
    try {
      const scanner = new Html5Qrcode("attendance-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1 },
        (value) => {
          const now = Date.now();
          if (lastScanRef.current.value !== value || now - lastScanRef.current.time > 3000) {
            lastScanRef.current = { value, time: now };
            markAttendance(value);
          }
        },
        () => {},
      );
      setScanning(true);
      setMessage("Scanner ready — place the QR code in front of the camera.");
    } catch (error) {
      setMessage(error?.name === "NotAllowedError" ? "Allow camera permission." : "Could not start the camera. Check HTTPS and camera permission.");
      scannerRef.current = null;
      setScanning(false);
    }
  };

  const scanQrPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setMessage("Scanning QR photo...");
      const photoScanner = new Html5Qrcode("attendance-qr-reader");
      const value = await photoScanner.scanFile(file, false);
      photoScanner.clear();
      markAttendance(value);
    } catch {
      setMessage("No QR code was found in the photo. Take another close, straight photo in good lighting.");
    }
  };

  const exportAttendance = () => {
    const sheet = XLSX.utils.json_to_sheet(records.map((record) => ({
      Date: record.date, Time: record.time, Student_ID: record.studentId,
      Name: record.name, Class: record.className, Status: record.status,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
    XLSX.writeFile(workbook, `attendance-${todayKey()}.xlsx`);
  };

  return <main className="attendance-page">
    <header className="attendance-header">
      <div><h2>QR Attendance</h2><p>{todayRecords.length} present today · {students.length} students loaded</p></div>
      <div className="attendance-actions">
        <button type="button" onClick={onBack}>Back to ID cards</button>
        <button type="button" onClick={exportAttendance} disabled={!records.length}>Export Excel</button>
      </div>
    </header>
    <div className="attendance-layout">
      <section className="scanner-card">
        <p className="scanner-message" role="status">{message}</p>
        <div className={`camera-frame ${scanning ? "active" : ""}`}><div id="attendance-qr-reader" /></div>
        <div className="scanner-controls">
          {!scanning ? <button type="button" onClick={startScanner}>Start camera scanner</button> : <button type="button" onClick={stopScanner}>Stop camera</button>}
          <input ref={qrPhotoInputRef} className="qr-photo-input" type="file" accept="image/*" capture="environment" onChange={scanQrPhoto} />
          <button type="button" onClick={() => qrPhotoInputRef.current?.click()}>Take a QR photo to scan</button>
          <form onSubmit={(event) => { event.preventDefault(); markAttendance(manualCode); setManualCode(""); }}>
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Student ID / scanned value" />
            <button type="submit" disabled={!manualCode.trim()}>Mark</button>
          </form>
        </div>
      </section>
      <section className="attendance-list">
        <h3>Today's attendance</h3>
        {!todayRecords.length ? <p className="empty-attendance">No attendance has been marked yet.</p> :
          <div className="attendance-table-wrap"><table><thead><tr><th>Time</th><th>Student ID</th><th>Name</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>{[...todayRecords].reverse().map((record) => <tr key={`${record.studentId}-${record.date}`}><td>{record.time}</td><td>{record.studentId}</td><td>{record.name}</td><td>{record.className || "—"}</td><td><span>Present</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>;
};

export default AttendancePage;
