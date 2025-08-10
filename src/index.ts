import express from "express";
import userRoutes from "./handler/user.handler"
import leaderBoardRoutes from "./handler/leader-board"
import { initConnections } from "./utils/cache/redis";
import LeaderBoardService from "./service/leaderboard";
const app = express();
const PORT = process.env.PORT || 5000;
async function startServer() {
  try {
    await initConnections();
    await LeaderBoardService.initialize()
    const app = express();
    app.use(express.json());
    app.use("/api/user",userRoutes)
    app.use("/api/leaderboard",leaderBoardRoutes)
    app.listen(PORT, () => {
      console.log(`Server is running on PORT:${PORT}`);
    });
  } catch (error: unknown) {
    console.error("Error in staring the nodejs server", error);
    process.exit(1);
  }
}

startServer();
