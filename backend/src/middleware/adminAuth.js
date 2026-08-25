const crypto = require("crypto");

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function login(req, res) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return res.status(503).json({ success: false, message: "Admin password is not configured on the server" });
  if (!safeEqual(req.body?.password, configuredPassword)) return res.status(401).json({ success: false, message: "Invalid admin password" });
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ success: true, token, expiresInSeconds: SESSION_TTL_MS / 1000 });
}

function validateNewPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function changePassword(req, res) {
  if (!validateNewPassword(req.body?.newPassword)) return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
  if (!safeEqual(req.body?.currentPassword, process.env.ADMIN_PASSWORD)) return res.status(401).json({ success: false, message: "Current password is incorrect" });
  // Runtime change is deliberately explicit; persist the new secret in the
  // deployment secret manager or backend .env before restarting the service.
  process.env.ADMIN_PASSWORD = req.body.newPassword;
  res.json({ success: true, message: "Password changed for the current backend session" });
}

function resetPassword(req, res) {
  const recoveryToken = process.env.ADMIN_RECOVERY_TOKEN;
  if (!recoveryToken) return res.status(503).json({ success: false, message: "Password recovery is not configured on the server" });
  if (!safeEqual(req.body?.recoveryToken, recoveryToken)) return res.status(401).json({ success: false, message: "Invalid recovery token" });
  if (!validateNewPassword(req.body?.newPassword)) return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
  process.env.ADMIN_PASSWORD = req.body.newPassword;
  res.json({ success: true, message: "Password reset for the current backend session; persist it in the secret manager before restart" });
}

function requireAdmin(req, res, next) {
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: "Admin authentication required" });
  }
  next();
}

module.exports = { login, requireAdmin, changePassword, resetPassword };
