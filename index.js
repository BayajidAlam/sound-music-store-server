const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const SSLCommerzPayment = require("sslcommerz-lts");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// SSLCommerz
const store_id = process.env.STORED_ID;
const store_passwd = process.env.STORED_PASS;
const is_live = false;
var uuid = require("uuid-random");

// mongo uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@myclaster-1.wxhqp81.mongodb.net/?retryWrites=true&w=majority`;

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
    const bookingsCollection = client.db("soundMusic").collection("bookings");
    const usersCollection = client.db("soundMusic").collection("users");

    // general/initial api
    app.get("/", (req, res) => {
      res.send("hello world");
    });

    //------------------  jwt api  ----------------//
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "12h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });
    //------------------  jwt api  ----------------//

    //------------------  SSLCommerz api  ----------------//
    // payment with sslcommerz
    app.post("/order", async (req, res) => {
      const order = req.body;
      // check the id & price on db
      const orderedProduct = await bookingsCollection.findOne({
        _id: new ObjectId(order.productId),
      });

      const data = {
        total_amount: orderedProduct.price,
        currency: "BDT",
        tran_id: uuid(), //unique tran_id for each api call
        success_url: "http://localhost:3030/success",
        fail_url: "http://localhost:3030/fail",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: order.productName,
        product_category: "musical",
        product_profile: "general",
        cus_name: order.customer,
        cus_email: order.email,
        cus_add1: order.location,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: order.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        console.log(apiResponse);
        res.send({url:GatewayPageURL});
      });
    });
    //------------------  SSLCommerz api  ----------------//

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
      const query = { catName: name };
      const data = await singleCategoryCollection.find(query).toArray();
      res.send(data);
    });

    // get the details of a category by id
    app.get("/viewDetails", async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await singleCategoryCollection.findOne(query);
      res.send(result);
      console.log(result);
    });
    //---------------    single Category api -------------//

    //---------------   booking api -------------//
    // post a book data to db
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // update booking status
    app.put("/setbooked/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          salesStatus: body.salesStatus,
        },
      };

      const result = await singleCategoryCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
      console.log(result);
    });

    // get all booking data
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
      const query = { buyerEmail: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });
    //---------------   booking api -------------//

    //---------------   users api -------------//
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
      console.log(result);
    });
    //---------------   users api -------------//
  } finally {
  }
}
run().catch(console.log());

app.listen(port, () => {
  console.log(`App is listening on port${port}`);
});
