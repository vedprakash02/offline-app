const { express, auth } = require("../config/dependenci.js");
const ClassSubject = require("../models/classSubject.js");
const { SCHOOL_CLASSES } = require("../config/academic.js");
const { isValidAcademicSession } = require("../utils/academicSession.js");

const router = express.Router();
const seniorClasses = new Set(["11th", "12th"]);
const canManageAcademicSetup = (user) => ["admin", "principal", "teacher"].includes(user?.role);

router.get("/academic/class-subjects", auth, async (req, res) => {
  try {
    const { academicSession, className, stream = "", allStreams = "" } = req.query;
    if (!isValidAcademicSession(academicSession)) {
      return res.status(400).json({ message: "A valid academic session is required." });
    }

    if (className && !SCHOOL_CLASSES.includes(className)) {
      return res.status(400).json({ message: "A valid class is required." });
    }

    if (className) {
      // Timetable setup for 11th/12th must offer every subject configured for
      // the class, regardless of its stream.  This lets one date contain
      // subjects from Science, Commerce and Arts together.
      if (seniorClasses.has(className) && String(allStreams) === "true") {
        const records = await ClassSubject.find({ academicSession, className }).lean();
        const subjects = [...new Map(records
          .flatMap((record) => record.subjects || [])
          .map((subject) => [String(subject).trim().toLowerCase(), String(subject).trim()]))
          .values()]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        return res.json({ subjects });
      }
      const record = await ClassSubject.findOne({
        academicSession,
        className,
        stream: seniorClasses.has(className) ? String(stream).trim() : "",
      }).lean();
      return res.json({ subjects: record?.subjects || [] });
    }

    const records = await ClassSubject.find({ academicSession }).sort({ className: 1, stream: 1 }).lean();
    return res.json({
      classes: Object.fromEntries(records.map((record) => [
        `${record.className}${record.stream ? `|${record.stream}` : ""}`,
        record.subjects,
      ])),
    });
  } catch (error) {
    console.error("Could not load academic subjects:", error);
    return res.status(500).json({ message: "Could not load academic subjects." });
  }
});

router.post("/academic/class-subjects", auth, async (req, res) => {
  try {
    if (!canManageAcademicSetup(req.user)) {
      return res.status(403).json({ message: "You do not have permission to manage academic setup." });
    }

    const { academicSession, className } = req.body;
    const subjects = Array.isArray(req.body.subjects) ? req.body.subjects : [];
    if (!isValidAcademicSession(academicSession) || !SCHOOL_CLASSES.includes(className)) {
      return res.status(400).json({ message: "A valid class and academic session are required." });
    }

    const stream = seniorClasses.has(className) ? String(req.body.stream || "").trim() : "";
    if (seniorClasses.has(className) && !stream) {
      return res.status(422).json({ message: "Select a stream for Classes 11 and 12." });
    }

    const cleanSubjects = [...new Map(subjects
      .map((subject) => String(subject).trim())
      .filter(Boolean)
      .map((subject) => [subject.toLowerCase(), subject])).values()];
    if (!cleanSubjects.length) {
      return res.status(422).json({ message: "Add at least one subject." });
    }

    const record = await ClassSubject.findOneAndUpdate(
      { academicSession, className, stream },
      { $set: { subjects: cleanSubjects } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      message: "Class subjects saved successfully.",
      className: record.className,
      stream: record.stream,
      subjects: record.subjects,
    });
  } catch (error) {
    console.error("Could not save academic subjects:", error);
    return res.status(500).json({ message: "Could not save academic subjects." });
  }
});

module.exports = router;
