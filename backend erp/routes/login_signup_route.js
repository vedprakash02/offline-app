const {
  express,
  jwt,
  bcrypt,
  AllowedUser,
  User,
} = require("../config/dependenci.js");
const { getJwtSecret } = require("../config/security.js");

const router = express.Router();

// ==================== SIGNUP ROUTE ====================
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    if (!cleanUsername || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password).length < 8) {
      return res.status(400).json({ success: false, message: "A valid username, email and password of at least 8 characters are required." });
    }

    // Fresh installation: the first account is securely bootstrapped as Admin.
    const isFirstAccount = (await User.countDocuments()) === 0;
    const requestedRole = isFirstAccount ? "admin" : String(role).trim().toLowerCase();
    if (!["admin", "teacher"].includes(requestedRole)) {
      return res.status(400).json({ success: false, message: "Only Admin and Teacher logins are allowed in the offline app." });
    }
    if (isFirstAccount) {
      await AllowedUser.findOneAndUpdate(
        { email: cleanEmail },
        { username: cleanUsername, email: cleanEmail, role: "admin" },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const allowedUser = await AllowedUser.findOne({ email: cleanEmail });
    if (!allowedUser) {
      return res.status(403).json({
        success: false,
        message: "This email is not approved in the master users list.",
      });
    }

    if (allowedUser.role !== requestedRole) {
      return res.status(400).json({
        success: false,
        message: `The approved role for this email is ${allowedUser.role}.`,
      });
    }

    const exitingUser = await User.findOne({ email: cleanEmail });
    if (exitingUser) {
      return res.status(400).json({
        success: false,
        message: "An account already exists for this email. Please log in."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      role: requestedRole, 
    });
    await newUser.save();

    return res.status(201).json({
      success: true,
      message: isFirstAccount ? "The first Vidya Prabandh Admin account has been created. Log in to continue." : "Your account has been created successfully.",
    });

  } catch (err) {
    console.error("Signup Error: ", err);
    if (err?.code === 11000) return res.status(409).json({ success: false, message: "An account already exists for this email." });
    return res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
});

// ==================== LOGIN ROUTE ====================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found. Enter the correct email." });
    }
    if (!user.active || !["admin", "teacher"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Login access is not allowed for this account." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect password. Please try again." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );


    console.log("Login successful for:", user.email);

    // ✅ Electron ke liye sirf JSON response bhejenge, cookie hata di hai
    return res.status(200).json({
      success: true,
      message: "Login successful",
      username: user.username,
      role: user.role,
      token,
      email: user.email,
    
    });
    

  } catch (err) {
    console.error("Login Error: ", err);
    // ✅ Response hamesha JSON format me hi hona chahiye
    return res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
});

module.exports = router;
