import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiClock, FiSave, FiAlertCircle, FiCheckCircle, FiEdit2, FiX, FiPlus } from "react-icons/fi";
import { SCHOOL_CLASSES } from "../../academicConfig";
import "./TimeTable.css";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const CLASS_RANGES = [
  { label: "1st - 5th", classes: ["1st", "2nd", "3rd", "4th", "5th"] },
  { label: "6th - 8th", classes: ["6th", "7th", "8th"] },
  { label: "9th - 12th", classes: ["9th", "10th", "11th", "12th"] }
];
const EXAM_TIME_GROUPS = [
  { key: "primary", label: "Primary (1-5)" },
  { key: "middle", label: "Middle (6-8)" },
  { key: "higher", label: "Higher (9-12)" },
];

export default function TimeTable() {
  const activeSession = localStorage.getItem("activeSession") || "";
  const [filters, setFilters] = useState({ examType: "" });
  const [examTimes, setExamTimes] = useState({ primary: "", middle: "", higher: "" });
  const [selectedClassRange, setSelectedClassRange] = useState("");
  const [scheduleData, setScheduleData] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [tempDateValue, setTempDateValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [savedStatus, setSavedStatus] = useState(false);

  // Load saved time table when exam type changes
  useEffect(() => {
    if (filters.examType) {
      loadTimeTable();
    }
  }, [filters.examType]);

  const changeFilter = ({ target: { name, value } }) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setStatus(null);
  };

  const selectClassRange = (range) => {
    setSelectedClassRange(range);
    setStatus(null);
  };

  const loadSubjectsForClass = async (className) => {
    const isSenior = ["11th", "12th"].includes(className);
    const params = { 
      academicSession: activeSession, 
      className: className
    };
    
    if (isSenior) params.allStreams = "true";
    
    try {
      const response = await axios.get("http://localhost:3000/academic/class-subjects", { headers: headers(), params });
      let subjects = response.data.subjects || [];
      if (!subjects.length && response.data.classes) {
        const classKey = Object.keys(response.data.classes).find(key => {
          const [cls, stream] = key.split('|');
          return cls === className && (!stream || stream.toLowerCase() === filters.stream?.toLowerCase());
        });
        if (classKey) {
          subjects = response.data.classes[classKey] || [];
        }
      }
      return subjects;
    } catch (error) {
      console.error("Error loading subjects:", error);
      return [];
    }
  };

  const updateCell = (date, className, subject) => {
    setScheduleData((current) => {
      const newData = { ...current };
      if (!newData[date]) {
        newData[date] = {};
      }
      newData[date][className] = subject;
      return newData;
    });
  };

  const deleteCell = (date, className) => {
    setScheduleData((current) => {
      const newData = { ...current };
      if (newData[date]) {
        delete newData[date][className];
        if (Object.keys(newData[date]).length === 0) {
          delete newData[date];
        }
      }
      return newData;
    });
  };

  const addDateRow = () => {
    // Generate a unique key for new row without date
    const newDateKey = `new-${Date.now()}`;
    console.log("Add Date Row clicked");
    console.log("Adding date row with key:", newDateKey);
    console.log("Current schedule data:", scheduleData);
    setScheduleData((current) => {
      const newData = { ...current };
      newData[newDateKey] = { _isEmpty: true }; // Mark as empty row
      console.log("New schedule data:", newData);
      return newData;
    });
  };

  const updateDate = (oldKey, newDate) => {
    setScheduleData((current) => {
      const newData = { ...current };
      if (newData[oldKey]) {
        newData[newDate] = { ...newData[oldKey], _isEmpty: false };
        delete newData[oldKey];
      }
      return newData;
    });
  };

  const removeDateRow = (date) => {
    setScheduleData((current) => {
      const newData = { ...current };
      delete newData[date];
      return newData;
    });
  };

  const saveTimeTable = async () => {
    console.log("Saving time table...", Object.keys(scheduleData).length);
    if (!filters.examType) {
      return setStatus({ type: "error", text: "Exam type select karein." });
    }
    if (Object.keys(scheduleData).length === 0) {
      return setStatus({ type: "error", text: "Kam se kam ek schedule add karein." });
    }

    setSaving(true);
    setStatus(null);
    try {
      // Remove _isEmpty flags before saving
      const cleanSchedule = {};
      Object.keys(scheduleData).forEach(key => {
        if (!key.startsWith('new-')) {
          cleanSchedule[key] = scheduleData[key];
        }
      });
      
      const payload = {
        examType: filters.examType,
        academicYear: activeSession,
        schedule: cleanSchedule,
        examTimes
      };
      console.log("Sending to backend:", payload);
      
      const response = await axios.post(
        "http://localhost:3000/time-table",
        payload,
        { headers: headers() }
      );
      
      console.log("Backend response:", response.data);
      setStatus({ type: "success", text: "Time table save ho gaya." });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 3000);
    } catch (error) {
      console.error("Save error:", error);
      console.error("Error response:", error.response?.data);
      setStatus({ type: "error", text: error.response?.data?.message || "Time table save nahi hua." });
    } finally {
      setSaving(false);
    }
  };

  const loadTimeTable = async () => {
    if (!filters.examType) {
      return setStatus({ type: "error", text: "Exam type select karein." });
    }
    setLoading(true);
    setStatus(null);
    try {
      const response = await axios.get("http://localhost:3000/time-table", {
        headers: headers(),
        params: {
          examType: filters.examType,
          academicYear: activeSession
        }
      });
      setScheduleData(response.data.schedule || {});
      setExamTimes({ primary: "", middle: "", higher: "", ...(response.data.examTimes || {}) });
      if (!response.data.schedule || Object.keys(response.data.schedule).length === 0) {
        setStatus({ type: "error", text: "Koi time table nahi mila." });
      }
    } catch (error) {
      setStatus({ type: "error", text: error.response?.data?.message || "Time table load nahi hua." });
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateString) => {
    // Parse dd/mm/yyyy to yyyy-mm-dd for storage
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
    return dateString;
  };

  const formatToInput = (dateString) => {
    // Convert yyyy-mm-dd to dd/mm/yyyy for display
    if (!dateString || dateString.startsWith('new-')) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDate = (dateString) => {
    return formatToInput(dateString);
  };

  const getFilteredClasses = () => {
    if (!selectedClassRange) return SCHOOL_CLASSES;
    const range = CLASS_RANGES.find(r => r.label === selectedClassRange);
    return range ? range.classes : SCHOOL_CLASSES;
  };

  const sortedDates = Object.keys(scheduleData).sort();

  return (
    <main className="time-table-page">
      <section className="time-table-setup-card">
      <header className="time-table-header">
        <div className="global-exam-times" aria-label="Exam time by class category">
          {EXAM_TIME_GROUPS.map((group) => {
            const [start = "", end = ""] = String(examTimes[group.key] || "").split(" - ");
            const updateTime = (index, value) => {
              const values = [start, end];
              values[index] = value;
              setExamTimes((current) => ({ ...current, [group.key]: values[0] && values[1] ? `${values[0]} - ${values[1]}` : values.filter(Boolean)[0] || "" }));
            };
            return <label key={group.key}><span>{group.label}</span><div><input type="time" value={start} onChange={(e) => updateTime(0, e.target.value)} /><b>–</b><input type="time" value={end} onChange={(e) => updateTime(1, e.target.value)} /></div></label>;
          })}
        </div>
        <div className="time-table-session">
          <span>Academic Session</span>
          <strong>{activeSession}</strong>
        </div>
      </header>

      {status && (
        <div className={`time-table-alert ${status.type}`}>
          {status.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
          <span>{status.text}</span>
          <button
            onClick={() => setStatus(null)}
            className="alert-close-btn"
          >
            <FiX />
          </button>
        </div>
      )}

      <div className="setup-controls">
      <section className="time-table-toolbar">
        <label>
          <span>Exam Type</span>
          <select name="examType" value={filters.examType} onChange={changeFilter}>
            <option value="">Select exam</option>
            <option>Quarterly</option>
            <option>Half-Yearly</option>
            <option>Annual</option>
          </select>
        </label>
      </section>

      <section className="class-range-filters">
        <span>Class Filter:</span>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${!selectedClassRange ? 'active' : ''}`}
            onClick={() => selectClassRange("")}
          >
            All Classes
          </button>
          {CLASS_RANGES.map((range) => (
            <button
              key={range.label}
              className={`filter-btn ${selectedClassRange === range.label ? 'active' : ''}`}
              onClick={() => selectClassRange(range.label)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </section>

      <section className="time-table-actions">
        <button type="button" onClick={addDateRow} className="add-row-btn">
          <FiPlus /> Add Date Row
        </button>
        <button type="button" onClick={saveTimeTable} disabled={saving || Object.keys(scheduleData).length === 0} className="save-btn">
          {savedStatus ? "Saved" : saving ? "Saving..." : "Save"}
        </button>
      </section>
      </div>
      </section>

      <section className="time-table-content">
        <div className="time-table-grid">
          {sortedDates.length === 0 ? (
            <div className="time-table-empty">
              <FiClock />
              <strong>"Add Date Row" button se date add karein</strong>
            </div>
          ) : (
            <div className="schedule-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {getFilteredClasses().map((className) => (
                      <th key={className}>{className}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map((date) => (
                    <tr key={date}>
                      <td className="date-cell">
                        {date.startsWith('new-') ? (
                          <input
                            type="text"
                            placeholder="dd/mm/yyyy"
                            onChange={(e) => {
                              const value = e.target.value;
                              console.log("New date input change:", value);
                              if (value && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                                console.log("Valid date format, updating:", parseDate(value));
                                updateDate(date, parseDate(value));
                              }
                            }}
                            autoFocus
                            className="date-text-input"
                          />
                        ) : (
                          editingDate === date ? (
                            <input
                              type="text"
                              value={tempDateValue}
                              placeholder="dd/mm/yyyy"
                              onChange={(e) => {
                                setTempDateValue(e.target.value);
                              }}
                              onBlur={() => {
                                if (tempDateValue && /^\d{2}\/\d{2}\/\d{4}$/.test(tempDateValue)) {
                                  const newDate = parseDate(tempDateValue);
                                  setScheduleData((current) => {
                                    const newData = { ...current };
                                    newData[newDate] = newData[date];
                                    delete newData[date];
                                    return newData;
                                  });
                                }
                                setEditingDate(null);
                                setTempDateValue('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              autoFocus
                              className="date-text-input"
                            />
                          ) : (
                            <div 
                              className="date-display-text"
                              onClick={() => {
                                setEditingDate(date);
                                setTempDateValue(formatToInput(date));
                              }}
                            >
                              {formatToInput(date)}
                            </div>
                          )
                        )}
                      </td>
                      {getFilteredClasses().map((className) => {
                        const subject = scheduleData[date]?.[className] || "";
                        const isEditing = editingCell?.date === date && editingCell?.className === className;
                        
                        return (
                          <td key={className} className="subject-cell">
                            {isEditing ? (
                              <CellEditor
                                className={className}
                                date={date}
                                currentSubject={subject}
                                onSave={(newSubject) => {
                                  updateCell(date, className, newSubject);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                                onDelete={() => {
                                  deleteCell(date, className);
                                  setEditingCell(null);
                                }}
                              />
                            ) : (
                              <div
                                className="subject-display"
                                onClick={() => setEditingCell({ date, className })}
                              >
                                {subject || <span className="empty-cell">Click to add</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="action-cell">
                        <button
                          onClick={() => removeDateRow(date)}
                          className="remove-row-btn"
                        >
                          <FiX />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function CellEditor({ className, date, currentSubject, onSave, onCancel, onDelete }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState(() => String(currentSubject || "").split(",").map((item) => item.trim()).filter(Boolean));
  const [loading, setLoading] = useState(false);
  const activeSession = localStorage.getItem("activeSession") || "";

  useEffect(() => {
    loadSubjects();
  }, [className]);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const isSenior = ["11th", "12th"].includes(className);
      const params = { 
        academicSession: activeSession, 
        className: className
      };
      
      if (isSenior) params.allStreams = "true";
      
      const response = await axios.get("http://localhost:3000/academic/class-subjects", { 
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, 
        params 
      });
      
      let loadedSubjects = response.data.subjects || [];
      setSubjects(loadedSubjects);
    } catch (error) {
      console.error("Error loading subjects:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cell-editor">
      {loading ? (
        <span>Loading...</span>
      ) : (
        <>
          <div className="subject-checkbox-list">
            {subjects.map((subject) => <label key={subject}><input type="checkbox" checked={selectedSubjects.includes(subject)} onChange={() => setSelectedSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject])} />{subject}</label>)}
          </div>
          <div className="editor-actions">
            <button onClick={() => onSave(selectedSubjects.join(", "))} className="save-action">
              Save
            </button>
            <button onClick={onDelete} className="delete-action">
              <FiX />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
