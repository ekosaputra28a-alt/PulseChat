import dotenv from "dotenv";

dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import path from "path";
import contactRoutes from "./routes/contactRoutes.js";

import { connectDB, getDB } from "./config/db.js";
import { ObjectId } from "mongodb";
import authRoutes from "./routes/authRoutes.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  maxHttpBufferSize: 1e8, // 100MB
});

app.use(cors());

app.use(express.json());

app.use("/upload", express.static("uploads"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/* ROUTES */

app.use("/auth", authRoutes);

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    fileUrl: `https://pulsechat-production-54e0.up.railway.app/upload/${req.file.filename}`,
    fileName: req.file.originalname,
  });
});

/* HOME */
app.get("/", (req, res) => {
  res.send("PulseChat API Running 🚀");
});

const onlineUsers = [];

app.get(
  "/messages",

  async (req, res) => {
    const db = getDB();
    const roomId = req.query.roomId;

    const messages = await db
      .collection("messages")
      .find({ roomId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(messages);
  },
);

app.use("/", contactRoutes);

io.on(
  "connection",

  (socket) => {
    console.log("User connected:", socket.id);

    /* JOIN ROOM */

    socket.on(
      "join_room",

      (roomId) => {
        socket.join(roomId);

        console.log(
          `${socket.id}
           joined
           ${roomId}`,
        );
      },
    );

    /* USER JOIN */

    socket.on(
      "user_join",

      (username) => {
        onlineUsers.push({
          id: socket.id,

          username,
        });

        io.emit("online_users", onlineUsers);
      },
    );

    /* SEND MESSAGE */

    socket.on(
      "send_message",

      async (data) => {
        const db = getDB();

        const message = db.collection("messages");

        const result = await message.insertOne({
          user: data.user,
          to: data.to || "",
          roomId: data.roomId || "",
          message: data.message || "",
          file: data.file || "",
          fileName: data.fileName || "",
          time: data.time,
          createdAt: new Date(),
        });

        const savedMessage = {
          ...data,
          _id: result.insertedId,
        };

        io.to(data.roomId)

          .emit("receive_message", savedMessage);
      },
    );


    socket.on("delete_message", async (data) => {
      try {
        const db = getDB();
        await db.collection("messages").deleteOne({
          _id: new ObjectId(data.messageId),
        });

        io.to(data.roomId)
          .emit("message_deleted", data.messageId);
      } catch (error) {
        console.error(err);
      }
    });

    /* DISCONNECT */

    socket.on(
      "disconnect",

      () => {
        console.log("User disconnected:", socket.id);

        const index = onlineUsers.findIndex((u) => u.id === socket.id);

        if (index !== -1) {
          onlineUsers.splice(index, 1);
        }

        io.emit("online_users", onlineUsers);
      },
    );
  },
);

/* DATABASE */

await connectDB();

/* SERVER */

server.listen(
  process.env.PORT,

  () => {
    console.log(`Server running on port ${process.env.PORT}`);
  },
);
