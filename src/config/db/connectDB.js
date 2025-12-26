if(process.env.NODE_ENV != "production"){
    require('dotenv').config()
}
const mongoose = require('mongoose');
const dbUrl = process.env.DB_URL;

connectDB()
.then(()=>{
    console.log("✅ Database connected successfully");
})
.catch((err)=>{
    console.log(err);
    process.exit(1);
})


async function connectDB(){
    await mongoose.connect(dbUrl);
}


module.exports = connectDB;