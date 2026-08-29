import mongoose, { Schema } from 'mongoose';

const snippetSchema = new Schema({
  category:{type:String,enum:['express','mongodb','fastapi','microservices'],required:true},
  difficulty:{type:String,enum:['short','medium','long'],required:true},
  code:{type:String,required:true}, language:{type:String,enum:['javascript','python'],required:true},
  patternTags:[String]
},{timestamps:true});

const projectFile = new Schema({
  path:{type:String,required:true}, code:{type:String,required:true},
  layer:{type:String,enum:['route','controller','service','model','middleware','config','util','test','readme'],required:true},
  order:{type:Number,required:true}
},{_id:false});

const projectSchema = new Schema({
  name:{type:String,required:true}, description:{type:String,required:true},
  category:{type:String,enum:['express','fastapi'],required:true},
  difficulty:{type:String,enum:['beginner','intermediate','advanced'],required:true},
  estimatedMinutes:{type:Number,required:true}, folderTree:[String], files:[projectFile]
},{timestamps:true});

const diagram = new Schema({
  className:String,type:{type:String,enum:['class','interface','enum']},fields:[String],methods:[String]
},{_id:false});
const lldFile = new Schema({path:String,code:String,pattern:String},{_id:false});
const lldSchema = new Schema({
  name:String,problemStatement:String,classDiagram:[diagram],
  language:{type:String,enum:['cpp','python','javascript']},files:[lldFile],
  difficulty:{type:String,enum:['beginner','intermediate','advanced']}
},{timestamps:true});

const item = new Schema({
  itemId:String,wpm:Number,accuracy:Number,errorCount:Number,timeTakenSeconds:Number,
  skipped:Boolean,structureCorrect:Boolean,group:String
},{_id:false});
const sessionSchema = new Schema({
  type:{type:String,enum:['drill','machine-coding','lld']},
  mode:{type:String,enum:['practice','evaluation','recall']},
  refId:{type:Schema.Types.ObjectId,default:null},
  itemsAttempted:[item],
  overall:{
    avgWpm:Number,avgAccuracy:Number,totalErrors:Number,completionPercent:Number,
    timeLimitSeconds:{type:Number,default:null},timeTakenSeconds:Number,score:Number,weakestArea:String
  }
},{timestamps:{createdAt:true,updatedAt:false}});

export const Snippet = mongoose.model('Snippet',snippetSchema);
export const Project = mongoose.model('Project',projectSchema);
export const LLDProblem = mongoose.model('LLDProblem',lldSchema);
export const Session = mongoose.model('Session',sessionSchema);
