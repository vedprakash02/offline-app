const { express, auth } = require("../config/dependenci.js");
const mongoose = require("mongoose");

const router = express.Router();

// Time Table Schema
const TimeTableSchema = new mongoose.Schema({
  examType: { type: String, required: true },
  academicYear: { type: String, required: true },
  schedule: { type: Object, default: {} },
  examTimes: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TimeTable = mongoose.models.TimeTable || mongoose.model("TimeTable", TimeTableSchema);

// GET /time-table - Load time table
router.get("/time-table", auth, async (req, res) => {
  try {
    const { examType, academicYear } = req.query;
    
    if (!examType || !academicYear) {
      return res.status(400).json({ message: "An exam type and academic year are required." });
    }

    const record = await TimeTable.findOne({
      examType,
      academicYear
    }).lean();

    return res.json({ schedule: record?.schedule || {}, examTimes: record?.examTimes || {} });
  } catch (error) {
    console.error("Could not load the timetable:", error);
    return res.status(500).json({ message: "Could not load the timetable." });
  }
});

// POST /time-table - Save time table
router.post("/time-table", auth, async (req, res) => {
  try {
    const { examType, academicYear, schedule, examTimes = {} } = req.body;
    
    if (!examType || !academicYear) {
      return res.status(400).json({ message: "An exam type and academic year are required." });
    }

    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({ message: "Invalid schedule data." });
    }

    const record = await TimeTable.findOneAndUpdate(
      { examType, academicYear },
      { 
        $set: { 
          schedule,
          examTimes: typeof examTimes === "object" && !Array.isArray(examTimes) ? examTimes : {},
          updatedAt: new Date()
        } 
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      message: "Timetable saved.",
      schedule: record.schedule,
      examTimes: record.examTimes || {}
    });
  } catch (error) {
    console.error("Could not save the timetable:", error);
    return res.status(500).json({ message: "Could not save the timetable." });
  }
});

module.exports = router;
