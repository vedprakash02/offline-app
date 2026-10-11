import React, { useState } from "react";
import AdmitCardSelection from "./AdmitCardSelection";
import AdmitCardDetail from "./AdmitCardDetail";

export default function AdmitCardWrapper() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [filters, setFilters] = useState({});

  if (selectedStudent) {
    return (
      <AdmitCardDetail
        student={selectedStudent}
        filters={filters}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  return (
    <AdmitCardSelection
      onSelectStudent={(student, filters) => {
        setSelectedStudent(student);
        setFilters(filters);
      }}
    />
  );
}
