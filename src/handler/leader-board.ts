import express from "express";
import LeaderBoardService from "../service/leaderboard";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const leaderBoardData = await LeaderBoardService.fetchLeaderboard()
    console.log(leaderBoardData);
    return res.status(200).json({
      success: true,
      leaderBoardData,
    });
  } catch (error: any) {
    console.log("Error in fetching the leaderboard");
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
