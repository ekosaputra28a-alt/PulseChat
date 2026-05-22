import express from "express";

import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

import { getDB }
from "../config/db.js";

const router =
    express.Router();

// REGISTER
router.post(
    "/register",

    async (req, res) => {

        try {

            const db =
                getDB();

            const users =
                db.collection("users");

            const {
                name,
                email,
                password
            } = req.body;

            const existingUser =
                await users.findOne({
                    email
                });

            if (existingUser) {

                return res.status(400).json({
                    message:
                        "Email already exists"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const result =
                await users.insertOne({
                    name,
                    email,
                    password:
                        hashedPassword,
                    createdAt:
                        new Date()
                });

            res.json({

                message:
                    "Register success",

                userId:
                    result.insertedId
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                message:
                    "Server error"
            });
        }
    }
);

// LOGIN
router.post(
    "/login",

    async (req, res) => {

        try {

            const db =
                getDB();

            const users =
                db.collection("users");

            const {
                email,
                password
            } = req.body;

            const user =
                await users.findOne({
                    email
                });

            if (!user) {

                return res.status(400).json({
                    message:
                        "User not found"
                });
            }

            const validPassword =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!validPassword) {

                return res.status(400).json({
                    message:
                        "Wrong password"
                });
            }

            const token =
                jwt.sign(

                    {
                        id: user._id,
                        email: user.email
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn: "7d"
                    }
                );

            res.json({

                token,

                user: {

                    id: user._id,

                    name: user.name,

                    email: user.email
                }
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                message:
                    "Server error"
            });
        }
    }
);

export default router;