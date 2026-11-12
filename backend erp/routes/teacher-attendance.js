const { express, auth } = require("../config/dependenci.js");
const Teacher = require("../models/teacher.js");
const TeacherAttendance = require("../models/teacherAttendance.js");
const router = express.Router();
const canManage = (user) => ["admin", "principal", "accountant"].includes(user?.role) || user?.permissions?.includes("teachers.manage");
const guard = (req, res, next) => canManage(req.user) ? next() : res.status(403).json({ message: "You do not have permission to manage teacher attendance." });
const attendanceStatuses = new Set(["Present", "Absent", "Late", "Leave", "Half Day"]);
const validTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

router.get("/teacher-attendance", auth, guard, async (req, res) => {
  try {
    const { date, month, teacherId } = req.query; const query = {};
    if (date) query.date = date; if (month) query.date = { $regex: `^${String(month).replace(/[^0-9-]/g, "")}` }; if (teacherId) query.teacherId = teacherId;
    const records = await TeacherAttendance.find(query).populate("teacherId", "name employeeId designation image status").sort({ date: -1 });
    res.json({ records });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get("/teacher-attendance/register/:date", auth, guard, async (req, res) => {
  try {
    const teachers = await Teacher.find({ status: "Active" }).select("name employeeId designation image").sort({ name: 1 }).lean();
    const records = await TeacherAttendance.find({ date: req.params.date }).lean(); const map = new Map(records.map((record) => [String(record.teacherId), record]));
    res.json({ teachers: teachers.map((teacher) => ({ ...teacher, attendance: map.get(String(teacher._id)) || null })) });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put("/teacher-attendance/register/:date", auth, guard, async (req, res) => {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date) || !Array.isArray(req.body.records)) return res.status(400).json({ message: "A valid date and attendance records are required." });
    const records = req.body.records.filter((row) => row.teacherId && row.status);
    if (records.some((row) => !attendanceStatuses.has(row.status) || !validTime(row.checkIn) || !validTime(row.checkOut) || (row.checkIn && row.checkOut && row.checkOut < row.checkIn) || typeof row.note === "string" && row.note.length > 500)) return res.status(400).json({ message: "The attendance status, time or note is invalid." });
    const teacherIds = [...new Set(records.map((row) => String(row.teacherId)))];
    const activeTeachers = await Teacher.find({ _id: { $in: teacherIds }, status: "Active" }).select("_id").lean();
    if (activeTeachers.length !== teacherIds.length) return res.status(400).json({ message: "Attendance can only be saved for active staff." });
    const operations = records.map((row) => ({ updateOne: { filter: { teacherId: row.teacherId, date: req.params.date }, update: { $set: { status: row.status, checkIn: row.checkIn || "", checkOut: row.checkOut || "", note: String(row.note || "").trim(), source: "manual", markedBy: req.user.id } }, upsert: true } }));
    if (operations.length) await TeacherAttendance.bulkWrite(operations);
    res.json({ message: `Attendance saved for ${operations.length} teachers.` });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
module.exports = router;
