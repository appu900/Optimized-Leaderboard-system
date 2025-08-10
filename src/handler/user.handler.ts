import express from "express";
import User from "../model/user.model";
import bcrypt from "bcryptjs";
import { redis } from "../utils/cache/redis";
import jwt from "jsonwebtoken";
const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password, email } = req.body;
  const userExists = await redis.sIsMember("registered_email", email);
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: "email is taken",
    });
  }
  await redis.sAdd("registered_email",email)
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  const userResponse = await User.create({
    username: username,
    password: hashedPassword,
    email: email,
  });
  return res.status(201).json({
    success: true,
    userResponse,
  });
});

router.post("/auth/me", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "invalid email or password" });
    const correctPassword = bcrypt.compareSync(password, user.password);
    if (!correctPassword)
      return res
        .status(404)
        .json({ success: false, message: "invalid email or password" });
    const token = jwt.sign({ id: user.id }, "rasaagshjagsqqyuwwyquwq7w", {
      expiresIn: "10d",
    });
    return res.status(200).json({
      success: true,
      userID:user.id,
      token: token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server error",
    });
  }
});

router.post("/update-score/:userId", async (req, res) => {
  try {
     const userId = req.params.userId;
     const newScore = req.body.score;
     const updateResponse = await User.findByIdAndUpdate(
        userId,
        { $set: { score: newScore } },
        { new: true }
     );
     console.log(updateResponse)
     if(!updateResponse){
        return res.status(400).json({
            message:"user not found"
        })
     }
     return res.status(200).json({
        success:true,
        message:"user score updated",
        score:updateResponse.score
     })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server error",
    });
  }
});

export default router;
