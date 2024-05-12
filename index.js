const express = require("express");
const cors = require("cors");
const colors = require("colors");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

// Init Express.
const app = express();

// Environment variable
const port = process.env.PORT || 9000;

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.use(cookieParser());

// cookies options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

// Mongo URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flkt4kr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDb client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Mongodb Connection function
async function run() {
  try {
    await client.connect();
    console.log(`MongoDb connection is successfull!`.bgGreen.black);

    // Auth related api
    app.post("/user", async (req, res) => {
      const loggedInUser = req.body;
      const email = loggedInUser.email;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("accessToken", token, cookieOptions);
      res.send({ status: true });
    });

    app.get("/user/logout", async (req, res) => {
      res.clearCookie("accessToken", { ...cookieOptions, maxAge: 0 });
      res.send({ message: "Logout successfull" });
    });

    // Routes
    app.get("/", (req, res) => {
      res.send(`FoodLane server is running on port : ${port}`);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Listen Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`.bgMagenta.black);
});
