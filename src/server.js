if(process.env.NODE_ENV != "production"){
    require('dotenv').config()
}
const dns = require('dns');
const http = require('http');

dns.setServers(['8.8.8.8', '1.1.1.1']); // Google + Cloudflare

const express = require('express');
const app = express();
const server = http.createServer(app);
const connectDB = require('./config/db/connectDB');
const cors = require('cors');
const {serve} = require('inngest/express');
const { inngest , functions} = require('./config/inngest/inngest');
const {clerkMiddleware} = require('@clerk/express');
const { protectRoute } = require('./middleware/protectRoute');
const seedProblems = require('./seeds/practiceProblems');
const { initializeSocketServer } = require('./config/websocket/socketServer');
const { BACKEND_PORT, BACKEND_HOST, BACKEND_PUBLIC_URL, ALLOWED_ORIGINS } =
  require('./config/appConfig');

// Import routes - Legacy routes
const chatRoutes = require('./routes/chatRoute');
const sessionRoutes = require('./routes/sessionRoute');

// Import routes - New modular routes
const interviewRoutes = require('./modules/interview/interviewRoute');
const userRoutes = require('./modules/user/userRoute');
const practiceRoutes = require('./routes/practiceRoute');

connectDB();

// Seed initial problems data
seedProblems().catch(err => console.error('Seed error:', err));


//middlewares
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(clerkMiddleware())



app.use("/api/inngest", serve({client: inngest, functions}));

// Legacy routes (deprecated - to be replaced)
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

// Public user routes (onboarding)
app.use("/api/users", userRoutes);

// New modular routes - Protected endpoints require authentication
app.use("/api/interviews", protectRoute, interviewRoutes);
app.use("/api/practice", protectRoute, practiceRoutes);

app.get("/health",(req,res)=>{
  res.status(200).json({msg:"api is up and running"});
})

// Catch 404
app.use((req, res) => {
  console.log("404 Not Found:", req.method, req.url);
  res.status(404).json({ msg: "Route not found" });
})

initializeSocketServer(server);

server.listen(BACKEND_PORT, BACKEND_HOST, () => {
  console.log(`✅ Server is running on ${BACKEND_PUBLIC_URL}`);
});


//ratikanta
