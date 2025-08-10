import { createClient } from "redis";
import mongoose from "mongoose";
import User from "../../../model/user.model";

export const redis = createClient();
redis.on("error", (err) => {
  console.error("Redis error", err);
});

export const initConnections = async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/userdb");
  console.log("mongodb is connected");
  await redis.connect();
  console.log("redis connected");
  const users = await User.find({}, { email: 1 });
  const emails = users.map((user) => user.email);
  console.log(emails)
  if (emails.length) await redis.sAdd("registered_email", emails);
  console.log("cached email of size", emails.length);
};
