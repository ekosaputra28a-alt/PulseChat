import express from "express";
import { getDB } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/search-users", verifyToken, async (req, res) => {
    try {
        const db = getDB();
        const { q, me } = req.query;

        const users = await db.collection("users").find({
            name: { $regex: q, $options: "i" },
        }).toArray();

        const filtered = users.filter(u => u.name !== me);
        res.json(filtered.map(u => ({ username: u.name })));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/add-contact", verifyToken, async (req, res) => {
    try {
        const db = getDB();
        const { owner, contact } = req.body;
        const contacts = db.collection("contacts");

        const existing = await contacts.findOne({ owner, contact });
        if (existing) {
            return res.status(400).json({ message: "Sudah jadi kontak" });
        }
        await contacts.insertOne ({
            owner,
            contact,
            createdAt: new Date()
        });
        res.json({ message: "Kontak ditambahkan "});
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/contacts", verifyToken, async (req, res) => {
    try {
        const db = getDB();
        const { owner } = req.query;

        const contacts = await db.collection("contacts")
            .find({ owner })
            .toArray();

        res.json(contacts.map(c => c.contact));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;