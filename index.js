const express = require("express");
const cors = require("cors");
const colors = require("colors");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// Init Express.
const app = express();

// Environment variable
const port = process.env.PORT || 9000;

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://food-lane-9e48d.web.app",
      "https://foodlane-server-pq5c5lrfr-md-saddam-hossen.vercel.app",
    ],
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

// Token varify middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  // Now verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).send({ message: "Unauthorized" });
    } else {
      req.user = decoded;
      next();
    }
  });
};

// Mongodb Connection function
async function run() {
  try {
    // await client.connect();
    // console.log(`MongoDb connection is successfull!`.bgGreen.black);

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

    // Logout with clear cookie
    app.get("/user/logout", async (req, res) => {
      res.clearCookie("accessToken", { ...cookieOptions, maxAge: 0 });
      res.send({ message: "Logout successfull" });
    });

    /**
     *  Foodlane apis
     * ===============
     */

    const foodCollection = client.db("foodLaneDB").collection("foodCollection");
    const purchaseFoodCollection = client
      .db("foodLaneDB")
      .collection("purchaseFoodCollection");

    // Get allFoods
    app.get("/allfoods", async (req, res) => {
      const allFoods = await foodCollection.find().toArray();
      res.send(allFoods);
    });

    // Get Single food by id
    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const singleFood = await foodCollection.findOne(query);
      res.send(singleFood);
    });

    // Add food item
    app.post("/food/add", async (req, res) => {
      const newFood = req.body;
      const result = await foodCollection.insertOne(newFood);
      res.send(result);
    });

    // Get my added item api
    app.get("/food/my/added", verifyToken, async (req, res) => {
      const userEmail = req.query.email;
      const tokenEmail = req.user.email;
      
      // Check valid user.
      if (userEmail !== tokenEmail) {
        return res.status(403).send({ message: "Forbiden!" });
      }

      const query = { userEmail: userEmail };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // Update purchase food item count field of foodCollection when purchase item.
    app.put("/food/update", async (req, res) => {
      const updatedData = req.body;
      const { id, count, quantity } = updatedData;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          count: count,
          quantity: quantity,
        },
      };
      const result = await foodCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Add purchase food items
    app.post("/food/purchase", async (req, res) => {
      const newPurchaseItem = req.body;
      const result = await purchaseFoodCollection.insertOne(newPurchaseItem);
      res.send(result);
    });

    // Get my purchase list api
    app.get("/food/my/purchase", verifyToken, async (req, res) => {
      const userEmail = req.query.email;
      const tokenEmail = req.user.email;

      // Check valid user.
      if (userEmail !== tokenEmail) {
        return res.status(403).send({ message: "Forbiden!" });
      }

      const query = { buyerEmail: userEmail };
      const result = await purchaseFoodCollection.find(query).toArray();
      res.send(result);
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
