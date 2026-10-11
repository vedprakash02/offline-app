const { express, auth } = require("../config/dependenci.js");
const mongoose = require("mongoose");

const router = express.Router();

// Time Table Schema
const TimeTableSchema = new mongoose.Schema({
  examType: { type: String, required: true },
  academicYear: { type: String, required: true },
  schedule: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TimeTable = mongoose.models.TimeTable || mongoose.model("TimeTable", TimeTableSchema);

// GET /time-table - Load time table
router.get("/time-table", auth, async (req, res) => {
  try {
    const { examType, academicYear } = req.query;
    
    if (!examType || !academicYear) {
      return res.status(400).json({ message: "Exam type aur academic year required hai." });
    }

    const record = await TimeTable.findOne({
      examType,
      academicYear
    }).lean();

    return res.json({ schedule: record?.schedule || {} });
  } catch (error) {
    console.error("Time table load nahi hua:", error);
    return res.status(500).json({ message: "Time table load nahi hua." });
  }
});

// POST /time-table - Save time table
router.post("/time-table", auth, async (req, res) => {
  try {
    const { examType, academicYear, schedule } = req.body;
    
    if (!examType || !academicYear) {
      return res.status(400).json({ message: "Exam type aur academic year required hai." });
    }

    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({ message: "Invalid schedule data." });
    }

    const record = await TimeTable.findOneAndUpdate(
      { examType, academicYear },
      { 
        $set: { 
          schedule,
          updatedAt: new Date()
        } 
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      message: "Time table save ho gaya.",
      schedule: record.schedule
    });
  } catch (error) {
    console.error("Time table save nahi hua:", error);
    return res.status(500).json({ message: "Time table save nahi hua." });
  }
});

module.exports = router;
