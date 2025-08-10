import mongoose, { Document, Schema } from "mongoose";
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  score: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true},
  email:{type:String,required:true},
  password:{type:String,required:true},
  score:{
    type:Number,
    default:0,
  }
},{timestamps:true});


const User = mongoose.model<IUser>("User",UserSchema);
export default User