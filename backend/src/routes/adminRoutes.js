const express = require("express");
const { login, requireAdmin, changePassword, resetPassword } = require("../middleware/adminAuth");

const router = express.Router();
router.post("/login", login);
router.post("/change-password", requireAdmin, changePassword);
router.post("/reset-password", resetPassword);
module.exports = router;
