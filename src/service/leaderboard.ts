import cron from "node-cron";
import { redis } from "../utils/cache/redis";
import User from "../model/user.model";

class LeaderBoardService {
  private static readonly LEADERBOARD_KEY = "leaderboared:global";
  private static readonly USER_RANK_PREFIX = "user:rank:";
  private static readonly TOP_USERS_KEY = "leaderboard:top:";
  private static readonly CACHE_TTL = 3600;

  static initCronJobs() {
    cron.schedule("*/1 * * * *", async () => {
      console.log("🔄 Starting daily leaderboard refresh...");
      await this.fullLeaderboardRefresh();
    });
    cron.schedule("0 * * * *", async () => {
      console.log("cron running for hourly");
      await this.refreshTopUsers(100);
    });
    cron.schedule("*/5 * * * *", async () => {
      await this.healthCheck();
    });
  }

  static async fullLeaderboardRefresh() {
    try {
      console.log("Starting full leaderboard refersh process...");
      const startTime = Date.now();
      await redis.del(this.LEADERBOARD_KEY);

      const batchSize = 10000;
      let skip = 0;
      let processedCount = 0;
      while (true) {
        const users = await User.find({}, { username: 1, score: 1 })
          .sort({ score: -1, createdAt: 1 })
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (users.length === 0) break;
        const pipeline = redis.multi();
        users.forEach((user, index) => {
          const globalRank = skip + index + 1;
          pipeline.zAdd(this.LEADERBOARD_KEY, {
            score: user.score,
            value: user._id.toString(),
          });
          pipeline.setEx(
            `${this.USER_RANK_PREFIX}${user._id}`,
            this.CACHE_TTL,
            globalRank.toString()
          );
        });

        await pipeline.exec();
        processedCount += users.length;
        skip += batchSize;
        console.log(`Processed ${processedCount} users...`);
      }
      await redis.expire(this.LEADERBOARD_KEY, 86400);
      console.log(`full refresh completed in ${Date.now()}`);
    } catch (error) {
      console.error("Error in full leadership refresh");
    }
  }


  static async fetchLeaderboard(){
   try {
      const leaderboard = await redis.zRangeWithScores(this.LEADERBOARD_KEY,0,-1,{REV:true})
      const leaderboardData = await Promise.all(
         leaderboard.map(async(entry,index)=>{
            const userId = entry.value
            const score = entry.score
            const user = await User.findById(userId,{username:1}).lean();
            const username = user?.username || "unknown"
            return {
               rank:index+1,
               userId,
               username,
               score
            }
         })
      )
   } catch (error) {
      throw error;
   }
  }

  static async refreshTopUsers(count: number) {
    try {
      const topUsers = await User.find({}, { password: 0 })
        .sort({ score: -1, createdAt: 1 })
        .limit(count)
        .lean();
      await redis.setEx(
        `${this.TOP_USERS_KEY}${count}`,
        this.CACHE_TTL,
        JSON.stringify(topUsers)
      );
      console.log("refrsh top users done");
    } catch (error) {
      console.error("error in refreshig top users");
    }
  }



  static initChnageStream() {
    const changeStream = User.watch([
      {
        $match: {
          $or: [
            { operationType: "update" },
            { operationType: "insert" },
            { operationType: "delete" },
          ],
        },
      },
    ],{fullDocument:'updateLookup'});

    changeStream.on('change',async(change)=>{
      try {
         await this.handleChngeStreamEvents(change)
      } catch (error) {
         console.error("Error in handling chnage stream")
      }
    })

    changeStream.on('error',(error)=>{
      console.error("change stream error",error)
      setTimeout(()=>this.initChnageStream(),5000)
    })
    console.log("Mongodb chnage stream intialiazed")
  }

  private static async handleChngeStreamEvents(change:any){
     const userId = change.documentKey._id.toString();
     switch(change.operationType){
      case 'insert':
      case 'update':
         const user = change.fullDocument;
         if(user && user.score !== undefined){
            await redis.zAdd(this.LEADERBOARD_KEY,{score:user.score,value:userId})
            await redis.del(`${this.USER_RANK_PREFIX}${userId}`);
            const userRank = await this.getUserRankFromRedis(userId)
            if(userRank && userRank <= 1000){
               await this.refreshTopUsers(1000);
               console.log(`updated user ${userId} with score ${user.score}`)
            }
         }
     }
  }

  private static async getUserRankFromRedis(userId:string):Promise<number | null>{
    try {
      const rank = await redis.zRevRank(this.LEADERBOARD_KEY,userId)
      return rank !== null ? rank + 1 : null
    } catch (error) {
      console.error("Error in getting users mark",error)
      return null;
    }
  }

  private static async healthCheck(){
    try {
      const redisHealth = await redis.ping();
      const leaderBoaredSize = await redis.zCard(this.LEADERBOARD_KEY)
      if(redisHealth !== "PONG"){
         console.error("redis health check failed")
         return;
      }
      if(leaderBoaredSize === 0){
         console.warn("leader board is empty")
         await this.fullLeaderboardRefresh();
      }
      console.log("health check Passed ✅")
    } catch (error) {
      console.error("health check failed",error)
    }
  }

  static async initialize(){
   try {
       this.initCronJobs();
       this.initChnageStream();
       const leaderboardSize = await redis.zCard(this.LEADERBOARD_KEY);
       if(leaderboardSize === 0){
         console.log("leader board is empty")
         await this.fullLeaderboardRefresh();
       }
   } catch (error) {
      console.error("Error in initializing the leader-board service")
      throw error;
   }
  }

 
}


export default LeaderBoardService;   
