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

// JWT Token varify middleware
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

    // All db collections.
    const userCollection = client.db("foodLaneDB").collection("userCollection");
    const foodCollection = client.db("foodLaneDB").collection("foodCollection");
    const purchaseFoodCollection = client
      .db("foodLaneDB")
      .collection("purchaseFoodCollection");
    const foodImgCollection = client
      .db("foodLaneDB")
      .collection("foodImgCollection");

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
    app.post("/user/logout", async (req, res) => {
      res
        .clearCookie("accessToken", { ...cookieOptions, maxAge: 0 })
        .send({ message: "Logout successfull" });
    });

    // After registration store user data.
    app.post("/foodlane/users", async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    /**
     *  Foodlane apis
     * ===============
     */

    // Get allFoods
    app.get("/allfoods", async (req, res) => {
      const allFoods = await foodCollection.find().toArray();
      res.send(allFoods);
    });

    // Get top-6 food item based on selleing
    app.get("/allfoods/count", async (req, res) => {
      const allFoods = await foodCollection.find().toArray();
      const sortedAllFoods = allFoods.sort((a, b) => {
        return b.count - a.count;
      });
      const topSellingFood = sortedAllFoods.slice(0, 6);
      res.send(topSellingFood);
    });

    // AllFood Search api
    app.get("/allfood/search", async (req, res) => {
      const searchValue = req.query.name;
      const data = await foodCollection
        .find({
          $or: [
            { name: { $regex: searchValue } },
            { category: { $regex: searchValue } },
          ],
        })
        .toArray();
      res.send(data);
    });

    // Get Single food by id
    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const singleFood = await foodCollection.findOne(query);
      res.send(singleFood);
    });

    // Add food item
    app.post("/food/add", verifyToken, async (req, res) => {
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

    // update my added item
    app.put("/food/myadded/update", async (req, res) => {
      const updatedData = req.body;
      const id = updatedData.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: updatedData.name,
          photo: updatedData.photo,
          price: updatedData.price,
          quantity: updatedData.quantity,
        },
      };

      const result = await foodCollection.updateOne(query, updatedDoc);
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
    app.post("/food/purchase", verifyToken, async (req, res) => {
      const newPurchaseItem = req.body;
      const result = await purchaseFoodCollection.insertOne(newPurchaseItem);
      res.send(result);
    });

    // Get my purchase food items list.
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

    // Delete my purchase item
    app.delete("/food/my/purchase/remove", async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await purchaseFoodCollection.deleteOne(query);
      res.send(result);
    });

    // Add image and feedback in gallery page api
    app.post("/gallery/add", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await foodImgCollection.insertOne(data);
      res.status(200).send(result);
    });

    // Get all feedback in gallery page
    app.get("/gallery/allfeedback", async (req, res) => {
      const result = await foodImgCollection.find().toArray();
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
