if(process.env.NODE_ENV != "production"){
    require('dotenv').config()
}

const express = require('express');
const app = express();



app.get("/health",(req,res)=>{
  res.status(200).json({message:"api is up and running"});
})

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});

