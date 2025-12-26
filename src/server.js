if(process.env.NODE_ENV != "production"){
    require('dotenv').config()
}

const express = require('express');
const app = express();
const connectDB = require('./config/db/connectDB');
const cors = require('cors');
const {serve} = require('inngest/express');
const { inngest } = require('./config/inngest/inngest');

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


app.use("/api/inngest", serve({client: inngest, functions}));

app.get("/health",(req,res)=>{
  res.status(200).json({message:"api is up and running"});
})

app.get("/books",(req,res)=>{
  res.send("this is books");
})

app.listen(process.env.PORT, () => {
  console.log(`✅ Server is running on http://localhost:${process.env.PORT}`);
});

