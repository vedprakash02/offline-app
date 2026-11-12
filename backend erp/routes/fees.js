const mongoose = require("mongoose");
const { express, Student, auth, Fee, FeeStructure } = require("../config/dependenci.js");
const { isValidAcademicSession, studentForSession } = require("../utils/academicSession.js");

const router = express.Router();

const canManageFees = (user) => ["teacher", "admin", "principal", "accountant"].includes(user?.role) || user?.permissions?.includes("fees.manage");

const buildReceiptNo = () => {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `FEE-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const serializeFee = (fee) => {
  const item = fee.toObject ? fee.toObject({ virtuals: true }) : fee;
  const payableAmount = Math.max(0, Number(item.totalAmount || 0) - Number(item.discount || 0) + Number(item.fine || 0));
  const paidAmount = (item.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return {
    ...item,
    payableAmount,
    paidAmount,
    balanceAmount: Math.max(0, payableAmount - paidAmount),
    status: item.currentStatus || item.status
  };
};

router.get("/fees", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to view fee records." });
    }

    const { search, studentClass, academicSession, status, feeType } = req.query;
    const feeQuery = {};

    if (academicSession) feeQuery.academicSession = academicSession;
    if (studentClass) feeQuery.class = studentClass;
    if (status) feeQuery.status = status;
    if (feeType) feeQuery.feeType = feeType;

    // UX Improvement: Ã Â¤Â°Ã Â¤Â¸Ã Â¥â‚¬Ã Â¤Â¦ Ã Â¤Â¸Ã Â¤â€šÃ Â¤â€“Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾ (FEE-) Ã Â¤Â¯Ã Â¤Â¾ Ã Â¤â€ºÃ Â¤Â¾Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â° Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â¨Ã Â¤Â¾Ã Â¤Â® Ã Â¤Â¦Ã Â¥â€¹Ã Â¤Â¨Ã Â¥â€¹Ã Â¤â€š Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤Å¡ Ã Â¤â€¢Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€š
    if (search) {
      if (search.toUpperCase().startsWith("FEE-")) {
        feeQuery["payments.receiptNo"] = { $regex: search, $options: "i" };
      } else {
        const studentQuery = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { admissionNo: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        };
        const matchedStudents = await Student.find(studentQuery).select("_id");
        feeQuery.studentId = { $in: matchedStudents.map((s) => s._id) };
      }
    }

    const fees = await Fee.find(feeQuery)
      .populate("studentId", "name fatherName admissionNo class stream rollNo phone")
      .sort({ createdAt: -1 });

    const records = fees.map(serializeFee);
    const summary = records.reduce(
      (acc, fee) => {
        acc.totalDemand += fee.payableAmount;
        acc.totalPaid += fee.paidAmount;
        acc.totalBalance += fee.balanceAmount;
        acc.records += 1;
        return acc;
      },
      { totalDemand: 0, totalPaid: 0, totalBalance: 0, records: 0 }
    );

    res.status(200).json({ success: true, fees: records, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: "Fee load error: " + error.message });
  }
});

router.post("/fees", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to create fees." });
    }

    const { studentId, academicSession, feeType, month, totalAmount, discount, fine, dueDate, initialPayment, paymentMode, note } = req.body;

    if (!/^\d{4}-\d{4}$/.test(academicSession || "")) {
      return res.status(400).json({ success: false, message: "Select a valid academic session." });
    }
    const amountValue = Number(totalAmount);
    const discountValue = Number(discount || 0);
    const fineValue = Number(fine || 0);
    const initialPaymentValue = Number(initialPayment || 0);
    if (![amountValue, discountValue, fineValue, initialPaymentValue].every(Number.isFinite) || amountValue <= 0 || discountValue < 0 || fineValue < 0 || initialPaymentValue < 0) {
      return res.status(400).json({ success: false, message: "Fee amounts must be valid and the total amount must be greater than 0." });
    }
    if (feeType === "Monthly" && !month) {
      return res.status(400).json({ success: false, message: "Select a month for the monthly fee." });
    }
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Select a valid student." });
    }

    // UX Protection: Ã Â¤ÂÃ Â¤â€¢ Ã Â¤Â¹Ã Â¥â‚¬ Ã Â¤Â®Ã Â¤Â¹Ã Â¥â‚¬Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â‚¬ Ã Â¤Â¦Ã Â¥â€¹Ã Â¤Â¬Ã Â¤Â¾Ã Â¤Â°Ã Â¤Â¾ Ã Â¤Â«Ã Â¥â‚¬Ã Â¤Â¸ Ã Â¤Å“Ã Â¤Â¨Ã Â¤Â°Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¨ Ã Â¤Â°Ã Â¥â€¹Ã Â¤â€¢Ã Â¤Â¨Ã Â¤Â¾
    if (feeType === "Monthly" && month) {
      const duplicateCheck = await Fee.findOne({ studentId, academicSession, feeType, month });
      if (duplicateCheck) {
        return res.status(400).json({ success: false, message: `The monthly fee for ${month} has already been created for this student.` });
      }
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });

    const payableAmount = Math.max(0, amountValue - discountValue + fineValue);
    const paymentAmount = initialPaymentValue;

    // UX Validation: Ã Â¤ÂÃ Â¤Â¡Ã Â¤ÂµÃ Â¤Â¾Ã Â¤â€šÃ Â¤Â¸ Ã Â¤Â¯Ã Â¤Â¾ Ã Â¤ÂÃ Â¤â€¢Ã Â¥ÂÃ Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¾ Ã Â¤ÂªÃ Â¥â€¡Ã Â¤Â®Ã Â¥â€¡Ã Â¤â€šÃ Â¤Å¸ Ã Â¤Â°Ã Â¥â€¹Ã Â¤â€¢Ã Â¤Â¨Ã Â¤Â¾
    if (paymentAmount > payableAmount) {
      return res.status(400).json({ success: false, message: `The first payment (₹${paymentAmount}) cannot exceed the total payable amount (₹${payableAmount}).` });
    }

    const payments = paymentAmount > 0 ? [{
      amount: paymentAmount,
      mode: paymentMode || "Cash",
      receiptNo: buildReceiptNo(),
      note: note || "Initial Payment",
      collectedBy: req.user.id,
    }] : [];

    const fee = new Fee({
      studentId,
      academicSession,
      class: student.class,
      stream: student.stream || "",
      feeType,
      month: month || "",
      totalAmount: amountValue,
      discount: discountValue,
      fine: fineValue,
      dueDate: dueDate || undefined,
      payments,
      createdBy: req.user.id,
    });

    await fee.save();
    await fee.populate("studentId", "name fatherName admissionNo class stream rollNo phone");

    res.status(201).json({ success: true, message: "Fee demand saved successfully.", fee: serializeFee(fee) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not save the fee:" + error.message });
  }
});

router.post("/fees/:id/payment", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) {
      return res.status(403).json({ success: false, message: "Permission denied." });
    }

    const { amount, mode, note } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: "The payment amount must be greater than 0." });
    }
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found." });

    const currentFeeData = serializeFee(fee);
    
    // UX Validation: Ã Â¤â€”Ã Â¤Â²Ã Â¤Â¤Ã Â¥â‚¬ Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â¡Ã Â¥ÂÃ Â¤Â¯Ã Â¥â€š Ã Â¤â€¦Ã Â¤Â®Ã Â¤Â¾Ã Â¤â€°Ã Â¤â€šÃ Â¤Å¸ Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Å“Ã Â¤Â¼Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾Ã Â¤Â¦Ã Â¤Â¾ Ã Â¤ÂªÃ Â¥Ë†Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤â€¢Ã Â¤Â²Ã Â¥â€¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Å¸ Ã Â¤Â¹Ã Â¥â€¹Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â°Ã Â¥â€¹Ã Â¤â€¢Ã Â¤Â¨Ã Â¤Â¾
    if (paymentAmount > currentFeeData.balanceAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Overpayment error: the maximum amount due is ₹${currentFeeData.balanceAmount}. You cannot collect ₹${amount}.` 
      });
    }

    fee.payments.push({
      amount: paymentAmount,
      mode: mode || "Cash",
      receiptNo: buildReceiptNo(),
      note: note || "",
      collectedBy: req.user.id,
    });

    await fee.save();
    await fee.populate("studentId", "name fatherName admissionNo class stream rollNo phone");

    res.status(200).json({ success: true, message: "Payment collected successfully.", fee: serializeFee(fee) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Payment fail: " + error.message });
  }
});

const streamLookup = (stream) => {
  const value = String(stream || "").trim();
  return value ? new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") : "";
};
const findFeeStructure = ({ academicSession, studentClass, stream }) => FeeStructure.findOne({ academicSession, class: studentClass, stream: streamLookup(stream) });
router.post("/fees/student/:studentId/payment", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession, amount, mode = "Cash", note = "", startMonth } = req.body;
    const paymentAmount = Number(amount);
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId) || !isValidAcademicSession(academicSession)) return res.status(400).json({ success: false, message: "A valid student and session are required." });
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return res.status(400).json({ success: false, message: "The payment amount must be greater than 0." });

    const studentDocument = await Student.findById(req.params.studentId);
    if (!studentDocument) return res.status(404).json({ success: false, message: "Student not found." });
    const student = studentForSession(studentDocument, academicSession);
    const structure = await findFeeStructure({ academicSession, studentClass: student.class, stream: student.stream });
    if (!structure) return res.status(404).json({ success: false, message: "Save the fee setup for this class first." });

    for (const item of structure.items) {
      const exists = await Fee.exists({ studentId: req.params.studentId, academicSession, feeStructureItemId: item._id });
      if (exists) continue;
      const months = item.frequency === "Monthly" ? Number(item.months || 12) : 1;
      await Fee.create({ studentId: req.params.studentId, academicSession, class: student.class, stream: student.stream || "", feeStructureItemId: item._id, feeName: item.feeType, frequency: item.frequency, feeType: item.feeType, month: item.frequency === "Monthly" ? `${startMonth || "Full session"} (${months} months)` : "", totalAmount: Number(item.amount) * months, createdBy: req.user.id });
    }

    const bills = await Fee.find({ studentId: req.params.studentId, academicSession }).sort({ createdAt: 1 });
    const totalBalance = bills.reduce((sum, bill) => sum + serializeFee(bill).balanceAmount, 0);
    if (paymentAmount > totalBalance) return res.status(400).json({ success: false, message: `The maximum pending balance is ${totalBalance}.` });

    const receiptNo = buildReceiptNo();
    const paidAt = new Date();
    let remaining = paymentAmount;
    const allocations = [];
    for (const bill of bills) {
      if (remaining <= 0) break;
      const balance = serializeFee(bill).balanceAmount;
      if (balance <= 0) continue;
      const allocated = Math.min(balance, remaining);
      bill.payments.push({ amount: allocated, mode, receiptNo, note, collectedBy: req.user.id, date: paidAt });
      await bill.save();
      allocations.push({ feeId: bill._id, feeName: bill.feeName || bill.feeType, amount: allocated });
      remaining -= allocated;
    }

    res.json({ success: true, message: "Payment saved successfully.", receipt: { receiptNo, date: paidAt, amount: paymentAmount, mode, note, allocations }, student });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not save the payment:" + error.message });
  }
});
router.delete("/fees/student/:studentId/payments/:receiptNo", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession } = req.query;
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId) || !isValidAcademicSession(academicSession)) return res.status(400).json({ success: false, message: "A valid student and session are required." });

    const bills = await Fee.find({ studentId: req.params.studentId, academicSession, "payments.receiptNo": req.params.receiptNo });
    if (!bills.length) return res.status(404).json({ success: false, message: "Payment receipt not found." });

    let removedAmount = 0;
    for (const bill of bills) {
      const removed = bill.payments.filter((payment) => payment.receiptNo === req.params.receiptNo);
      removedAmount += removed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      bill.payments = bill.payments.filter((payment) => payment.receiptNo !== req.params.receiptNo);
      await bill.save();
    }

    res.json({ success: true, message: `Payment of ${removedAmount} for ${req.params.receiptNo} deleted.`, removedAmount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not delete the payment:" + error.message });
  }
});
router.delete("/fees/:id", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete records." });
    }
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, message: "Record not found." });
    if (fee.payments?.length) return res.status(400).json({ success: false, message: "A bill with payment history cannot be deleted." });
    await fee.deleteOne();
    res.status(200).json({ success: true, message: "Fee record deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/fee-structures", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession, studentClass, stream = "" } = req.query;
    if (!isValidAcademicSession(academicSession) || !studentClass) return res.status(400).json({ success: false, message: "A session and class are required." });
    const structure = await FeeStructure.findOne({ academicSession, class: studentClass, stream });
    res.json({ success: true, structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/fee-structures", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession, studentClass, stream = "", items = [] } = req.body;
    if (!isValidAcademicSession(academicSession) || !studentClass) return res.status(400).json({ success: false, message: "Select a valid session and class." });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "Add at least one fee item." });
    const cleanItems = items.map((item) => ({ feeType: String(item.feeType || "").trim(), amount: Number(item.amount), frequency: item.frequency, months: item.frequency === "Monthly" ? Math.min(12, Math.max(1, Number(item.months || 12))) : 1 }));
    if (cleanItems.some((item) => !item.feeType || !Number.isFinite(item.amount) || item.amount <= 0)) return res.status(400).json({ success: false, message: "Each fee item requires a fee type and valid amount." });
    const structure = await FeeStructure.findOneAndUpdate(
      { academicSession, class: studentClass, stream },
      { $set: { items: cleanItems, updatedBy: req.user.id } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ success: true, message: "Class fee setup saved.", structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.code === 11000 ? "A fee setup already exists for this class." : error.message });
  }
});

router.delete("/fee-structures", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession, studentClass, stream = "" } = req.query;
    if (!isValidAcademicSession(academicSession) || !studentClass) return res.status(400).json({ success: false, message: "A session and class are required." });
    const deleted = await FeeStructure.findOneAndDelete({ academicSession, class: studentClass, stream });
    if (!deleted) return res.status(404).json({ success: false, message: "Saved fee setup not found." });
    res.json({ success: true, message: "Saved fee setup deleted. You can now create a new setup." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post("/fees/generate", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { studentId, academicSession, month } = req.body;
    if (!mongoose.Types.ObjectId.isValid(studentId) || !isValidAcademicSession(academicSession)) return res.status(400).json({ success: false, message: "Select a valid student and session." });
    const studentDocument = await Student.findById(studentId);
    if (!studentDocument) return res.status(404).json({ success: false, message: "Student not found." });
    const student = studentForSession(studentDocument, academicSession);
    const structure = await findFeeStructure({ academicSession, studentClass: student.class, stream: student.stream });
    if (!structure) return res.status(404).json({ success: false, message: "Save the fee setup for this class and session first." });
    if (structure.items.some((item) => item.frequency === "Monthly") && !/^\d{4}-\d{2}$/.test(month || "")) return res.status(400).json({ success: false, message: "Select a month for the monthly fee." });
    let created = 0;
    for (const item of structure.items) {
      const exists = await Fee.exists({ studentId, academicSession, feeStructureItemId: item._id });
      if (exists) continue;
      const months = item.frequency === "Monthly" ? Number(item.months || 12) : 1;
      await Fee.create({
        studentId,
        academicSession,
        class: student.class,
        stream: student.stream || "",
        feeStructureItemId: item._id,
        feeName: item.feeType,
        frequency: item.frequency,
        feeType: item.feeType,
        month: item.frequency === "Monthly" ? `${month} (${months} months)` : "",
        totalAmount: Number(item.amount) * months,
        createdBy: req.user.id,
      });
      created += 1;
    }
    res.json({ success: true, message: created ? `Generated ${created} fee demands.` : "Fees for this period have already been generated.", created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/fees/student/:studentId/summary", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ success: false, message: "Permission denied." });
    const { academicSession } = req.query;
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId) || !isValidAcademicSession(academicSession)) return res.status(400).json({ success: false, message: "A valid student and session are required." });
    const studentDocument = await Student.findById(req.params.studentId);
    if (!studentDocument) return res.status(404).json({ success: false, message: "Student not found." });
    const student = studentForSession(studentDocument, academicSession);
    const records = (await Fee.find({ studentId: req.params.studentId, academicSession }).sort({ dueDate: 1, createdAt: 1 })).map(serializeFee);
    const paymentMap = new Map();
    for (const fee of records) {
      for (const payment of fee.payments || []) {
        const key = payment.receiptNo;
        const existing = paymentMap.get(key) || { receiptNo: key, date: payment.date, mode: payment.mode, note: payment.note, amount: 0, feeNames: [] };
        existing.amount += Number(payment.amount || 0);
        if (!existing.feeNames.includes(fee.feeName || fee.feeType)) existing.feeNames.push(fee.feeName || fee.feeType);
        paymentMap.set(key, existing);
      }
    }
    const payments = [...paymentMap.values()].map((payment) => ({ ...payment, feeName: payment.feeNames.join(", ") })).sort((a, b) => new Date(b.date) - new Date(a.date));
    const billedTotals = records.reduce((sum, fee) => ({ demand: sum.demand + fee.payableAmount, paid: sum.paid + fee.paidAmount, balance: sum.balance + fee.balanceAmount }), { demand: 0, paid: 0, balance: 0 });
    const structure = await findFeeStructure({ academicSession, studentClass: student.class, stream: student.stream });
    const configuredDemand = (structure?.items || []).reduce((sum, item) => sum + Number(item.amount || 0) * (item.frequency === "Monthly" ? Number(item.months || 12) : 1), 0);
    const totals = { demand: Math.max(configuredDemand, billedTotals.demand), paid: billedTotals.paid, balance: Math.max(0, Math.max(configuredDemand, billedTotals.demand) - billedTotals.paid) };
    res.json({ success: true, student, fees: records, payments, totals, configuredDemand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get("/fees/due-reminders", auth, async (req, res) => {
  try {
    if (!canManageFees(req.user)) return res.status(403).json({ message: "You do not have permission to view fee reminders." });
    const { academicSession, studentClass = "" } = req.query;
    if (!isValidAcademicSession(academicSession)) return res.status(400).json({ message: "A valid academic session is required." });
    const query = { academicSession, ...(studentClass ? { class: studentClass } : {}) };
    const bills = await Fee.find(query).populate("studentId", "name fatherName admissionNo class phone").sort({ dueDate: 1 });
    const grouped = new Map();
    for (const bill of bills) {
      const fee = serializeFee(bill); if (fee.balanceAmount <= 0 || !fee.studentId) continue;
      const id = String(fee.studentId._id); const row = grouped.get(id) || { studentId: id, name: fee.studentId.name, fatherName: fee.studentId.fatherName, admissionNo: fee.studentId.admissionNo, class: fee.studentId.class, phone: fee.studentId.phone, balance: 0, oldestDueDate: null, billCount: 0 };
      row.balance += fee.balanceAmount; row.billCount += 1;
      if (fee.dueDate && (!row.oldestDueDate || new Date(fee.dueDate) < new Date(row.oldestDueDate))) row.oldestDueDate = fee.dueDate;
      grouped.set(id, row);
    }
    const reminders = [...grouped.values()].sort((a, b) => b.balance - a.balance).map((row) => ({ ...row, message: `Dear Parent, the school fee of ₹${Math.round(row.balance).toLocaleString("en-IN")} for ${row.name} (Class ${row.class}) is pending. Please pay at the school office. Session: ${academicSession}.` }));
    res.json({ reminders, totalDue: reminders.reduce((sum, row) => sum + row.balance, 0), studentsDue: reminders.length });
  } catch (error) { res.status(500).json({ message: `Could not load due reminders: ${error.message}` }); }
});
module.exports = router;





