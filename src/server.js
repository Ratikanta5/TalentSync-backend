if(process.env.NODE_ENV != "production"){
    require('dotenv').config()
}

const express = require('express');
const app = express();
const connectDB = require('./config/db/connectDB');
const cors = require('cors');
const {serve} = require('inngest/express');
const { inngest , functions} = require('./config/inngest/inngest');
const {clerkMiddleware} = require('@clerk/express');
const { protectRoute } = require('./middleware/protectRoute');
const chatRoute = require('./routes/chatRoute');

connectDB();


//middlewares
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(clerkMiddleware())



app.use("/api/inngest", serve({client: inngest, functions}));

app.use("/api/chat", chatRoute);

app.get("/health",(req,res)=>{
  res.status(200).json({msg:"api is up and running"});
})



app.listen(process.env.PORT, () => {
  console.log(`✅ Server is running on http://localhost:${process.env.PORT}`);
});

