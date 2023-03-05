const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongo uri
const uri = "mongodb+srv://soundUser:ea9HByXraLWbBwRz@myclaster-1.wxhqp81.mongodb.net/?retryWrites=true&w=majority";
console.log(uri);

// mongoClient
const client = new MongoClient(uri, { useNewUrlParser: true, 
  useUnifiedTopology: true, 
  serverApi: ServerApiVersion.v1 
});

async function run() {
  try {
    const categoryCollection = client.db("soundMusic").collection("categories");

    // general api
    app.get("/", (req, res) => {
      res.send("hello world");
    });

    // get all categories
    app.get('/categories', async(req,res)=>{
      const query = {};
      const option = categoryCollection.find(query)
      const result = await option.toArray();
      res.send(result)
    })
  } finally {
  }
}
run().catch(console.log());

app.listen(port, () => {
  console.log(`App is listening on port${port}`);
});
