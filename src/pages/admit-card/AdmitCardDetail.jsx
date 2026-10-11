import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiPrinter, FiArrowLeft, FiAlertCircle } from "react-icons/fi";
import "./AdmitCardDetail.css";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function AdmitCardDetail({ student, filters, onBack }) {
  const activeSession = localStorage.getItem("activeSession") || "";
  const [schoolProfile, setSchoolProfile] = useState(null);

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

  const printAdmitCard = () => {
    document.body.classList.add("admit-detail-print-active");

    const finishPrinting = () => {
      document.body.classList.remove("admit-detail-print-active");
      window.removeEventListener("afterprint", finishPrinting);
    };

    window.addEventListener("afterprint", finishPrinting);
    window.print();
  };

  if (!student) {
    return (
      <main className="admit-card-detail-page">
        <div className="admit-card-detail-empty">
          <FiAlertCircle />
          <strong>Koi student select nahi hua</strong>
        </div>
      </main>
    );
  }

  return (
    <main className="admit-card-detail-page">
      <header className="admit-card-detail-header">
        <button className="back-btn" onClick={onBack}>
          <FiArrowLeft /> Back
        </button>
        <div>
          <h2>{student.name} - Admit Card</h2>
          <p>{filters.examType} Examination - {activeSession}</p>
        </div>
        <button className="print-btn" onClick={printAdmitCard}>
          <FiPrinter /> Print
        </button>
      </header>

      <section className="admit-card-detail-container">
        <div className="admit-card-detail">
          <div className="admit-card-detail-header-section">
            <h3>ADMIT CARD</h3>
            <p>{filters.examType} Examination - {activeSession}</p>
          </div>

          {schoolProfile && (
            <div className="admit-card-detail-school">
              <h4>{schoolProfile.schoolName || "School Name"}</h4>
              <p>{schoolProfile.address || "School Address"}</p>
              {schoolProfile.phoneNumber && <p>Phone: {schoolProfile.phoneNumber}</p>}
            </div>
          )}

          <div className="admit-card-detail-student">
            <div className="student-photo">
              {student.imageUrl ? (
                <img src={student.imageUrl} alt={`${student.name}`} />
              ) : (
                <div className="photo-placeholder">Photo</div>
              )}
            </div>
            <div className="student-details">
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{student.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Roll No:</span>
                <span className="detail-value">{student.rollNo || "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Admission No:</span>
                <span className="detail-value">{student.admissionNo || "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Class:</span>
                <span className="detail-value">{filters.class}{filters.stream ? ` - ${filters.stream}` : ""}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Father's Name:</span>
                <span className="detail-value">{student.fatherName || "—"}</span>
              </div>
            </div>
          </div>

          <div className="admit-card-detail-footer">
            <div className="exam-details">
              <div className="detail-row">
                <span className="detail-label">Exam:</span>
                <span className="detail-value">{filters.examType}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Session:</span>
                <span className="detail-value">{activeSession}</span>
              </div>
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
      </section>
    </main>
  );
}
