require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

let s3 = null;
if (process.env.STORAGE_MODE === "s3") {
  const AWS = require("aws-sdk");
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const devices = new Map();
const files = new Map();
const transfers = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

const uploadLimiter = rateLimit({ windowMs: 60_000, max: 20, message: "Too many uploads." });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  try {
    const { expiryMs, targetDevice } = req.body;
    const expiry = parseInt(expiryMs) || parseInt(process.env.DEFAULT_EXPIRY_MS) || 3_600_000;
    const fileId = uuidv4();
    const expiresAt = Date.now() + expiry;
    const meta = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      expiresAt,
      downloads: 0,
    };

    if (process.env.STORAGE_MODE === "s3") {
      const fileStream = fs.createReadStream(req.file.path);
      const s3Key = `uploads/${fileId}/${req.file.originalname}`;
      await s3.upload({ Bucket: process.env.S3_BUCKET_NAME, Key: s3Key, Body: fileStream, ContentType: req.file.mimetype }).promise();
      fs.unlinkSync(req.file.path);
      meta.s3Key = s3Key;
    } else {
      meta.storagePath = req.file.path;
    }

    files.set(fileId, meta);
    setTimeout(() => deleteFile(fileId), expiry);

    if (targetDevice && devices.has(targetDevice)) {
      const { socketId } = devices.get(targetDevice);
      const transferId = uuidv4();
      transfers.set(transferId, { from: req.body.senderName || "Unknown", to: targetDevice, fileId, status: "pending", progress: 0 });
      io.to(socketId).emit("incoming_file", {
        transferId,
        fileId,
        fileName: meta.originalName,
        fileSize: meta.size,
        from: req.body.senderName || "Unknown",
        expiresAt,
        downloadUrl: `/api/download/${fileId}`,
      });
    }

    res.json({
      success: true,
      fileId,
      downloadUrl: `/api/download/${fileId}`,
      shareableUrl: `${req.protocol}://${req.get("host")}/api/download/${fileId}`,
      expiresAt,
      expiresIn: expiry,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", detail: err.message });
  }
});

app.get("/api/download/:fileId", async (req, res) => {
  const meta = files.get(req.params.fileId);
  if (!meta) return res.status(404).json({ error: "File not found or expired" });
  if (Date.now() > meta.expiresAt) {
    deleteFile(req.params.fileId);
    return res.status(410).json({ error: "Link has expired" });
  }

  meta.downloads++;
  res.setHeader("Content-Disposition", `attachment; filename="${meta.originalName}"`);
  res.setHeader("Content-Type", meta.mimeType);

  if (process.env.STORAGE_MODE === "s3") {
    const stream = s3.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: meta.s3Key }).createReadStream();
    stream.pipe(res);
  } else {
    if (!fs.existsSync(meta.storagePath)) return res.status(404).json({ error: "File missing on disk" });
    res.download(meta.storagePath, meta.originalName);
  }
});

app.get("/api/file/:fileId", (req, res) => {
  const meta = files.get(req.params.fileId);
  if (!meta) return res.status(404).json({ error: "Not found" });
  res.json({ originalName: meta.originalName, size: meta.size, mimeType: meta.mimeType, expiresAt: meta.expiresAt, downloads: meta.downloads });
});

app.get("/api/devices", (req, res) => {
  const list = Array.from(devices.entries()).map(([name, d]) => ({ name, joinedAt: d.joinedAt }));
  res.json(list);
});

async function deleteFile(fileId) {
  const meta = files.get(fileId);
  if (!meta) return;
  files.delete(fileId);
  if (process.env.STORAGE_MODE === "s3" && meta.s3Key) {
    try { await s3.deleteObject({ Bucket: process.env.S3_BUCKET_NAME, Key: meta.s3Key }).promise(); } catch (_) {}
  } else if (meta.storagePath && fs.existsSync(meta.storagePath)) {
    fs.unlinkSync(meta.storagePath);
  }
}

io.on("connection", (socket) => {
  let myDeviceName = null;

  socket.on("register_device", ({ deviceName }) => {
    if (!deviceName || deviceName.length > 30) return socket.emit("register_error", "Invalid name");
    if (devices.has(deviceName)) return socket.emit("register_error", "Name already taken");
    myDeviceName = deviceName;
    devices.set(deviceName, { socketId: socket.id, joinedAt: Date.now() });
    socket.emit("registered", { deviceName });
    io.emit("device_list", Array.from(devices.keys()));
    console.log(`[+] Device registered: ${deviceName}`);
  });

  socket.on("transfer_progress", ({ transferId, progress }) => {
    const t = transfers.get(transferId);
    if (!t) return;
    t.progress = progress;
    if (devices.has(t.to)) {
      io.to(devices.get(t.to).socketId).emit("transfer_progress", { transferId, progress });
    }
  });

  socket.on("transfer_complete", ({ transferId }) => {
    const t = transfers.get(transferId);
    if (t && devices.has(t.from)) {
      io.to(devices.get(t.from).socketId).emit("transfer_complete", { transferId, to: t.to });
    }
    transfers.delete(transferId);
  });

  socket.on("disconnect", () => {
    if (myDeviceName) {
      devices.delete(myDeviceName);
      io.emit("device_list", Array.from(devices.keys()));
      console.log(`[-] Device disconnected: ${myDeviceName}`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀  FileShare running on http://localhost:${PORT}`));
