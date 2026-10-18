const mongoose = require("mongoose");

const AllowedUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "teacher"], required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AllowedUser", AllowedUserSchema);
