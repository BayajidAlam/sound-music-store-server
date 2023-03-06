const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongo uri
const uri =
  "mongodb+srv://soundUser:ea9HByXraLWbBwRz@myclaster-1.wxhqp81.mongodb.net/?retryWrites=true&w=majority";


// mongoClient
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    // collections
    const categoryCollection = client.db("soundMusic").collection("categories");
    const singleCategoryCollection = client
      .db("soundMusic")
      .collection("singleCategory");

    // general api
    app.get("/", (req, res) => {
      res.send("hello world");
    });

    //------------------  all category api  ----------------//
    // get all categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const option = categoryCollection.find(query);
      const result = await option.toArray();
      res.send(result);
    });
    //------------------  all category api  ----------------//

    //---------------    single Category api -------------//
    // get data of a single category
    app.get("/category", async (req, res) => {
      const name = req.query.name;
      const query = { catName: name};
      const data = await singleCategoryCollection.find(query).toArray();
      res.send(data);
    });

    // get the details of a category by id 
    app.get('/viewDetails', async(req,res)=>{
      const id = req.query.id;
      const query = { _id: new ObjectId(id)}
      const result = await singleCategoryCollection.findOne(query)
      res.send(result);
      console.log(result);
    })
    //---------------    single Category api -------------//
  } finally {
  }
}
run().catch(console.log());

app.listen(port, () => {
  console.log(`App is listening on port${port}`);
});
