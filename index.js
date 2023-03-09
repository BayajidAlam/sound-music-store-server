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

// middleWare for verify JWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
  });
  req.decoded = decoded;
  next();
}

async function run() {
  try {
    // collections
    const categoryCollection = client.db("soundMusic").collection("categories");
    const singleCategoryCollection = client
      .db("soundMusic")
      .collection("singleCategory");
    const bookingsCollection = client.db("soundMusic").collection("bookings");
    const usersCollection = client.db("soundMusic").collection("users");
    const orderssCollection = client.db("soundMusic").collection("orders");

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

      if (!order.price || !order.email || !order.phone) {
        return res.send({ error: "Please provide all" });
      }
      const transId = uuid();
      // check the id & price on db
      const orderedProduct = await bookingsCollection.findOne({
        _id: new ObjectId(order.productId),
      });

      const data = {
        total_amount: orderedProduct.price,
        currency: "BDT",
        tran_id: transId, //unique tran_id for each api call
        success_url: `https://sound-music-server.vercel.app/payment/success?transactionId=${transId}`,
        fail_url: `https://sound-music-server.vercel.app/payment/fail?transactionId=${transId}`,
        cancel_url: "https://sound-music-server.vercel.app/payment/cancel",
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

        // save order to db
        orderssCollection.insertOne({
          ...order,
          price: orderedProduct.price,
          transactionId: transId,
          paid: false,
        });
        res.send({ url: GatewayPageURL });
      });
    });

    // payment success api
    app.post("/payment/success", async (req, res) => {
      const { transactionId } = req.query;
      if (!transactionId) {
        return res.redirect("http://localhost:3000/payment/fail");
      }

      const result = await orderssCollection.updateOne(
        { transactionId },
        { $set: { paid: true, paidAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:3000/payment/success?transactionId=${transactionId}`
        );
      }
    });

    // get specific trans id details
    app.get("/orders/by-transaction-id/:id", async (req, res) => {
      const { id } = req.params;
      const order = await orderssCollection.findOne({ transactionId: id });
      res.send(order);
    });

    // payment failure api
    app.post("/payment/fail", async (req, res) => {
      const { transactionId } = req.query;
      if (!transactionId) {
        return res.redirect("http://localhost:3000/payment/fail");
      }
      const result = await orderssCollection.deleteOne({ transactionId });
      if (result.deletedCount) {
        res.redirect("http://localhost:3000/payment/fail");
      }
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
      // const decodedEmail = req.decoded.email;
      // if(email !== decodedEmail){
      //   return res.status(403).send({message: 'forbidden access'})
      // }
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

    //--------------- seller dashboard api -------------//
    // get a user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    //  post a product
    app.post("/product", async (req, res) => {
      const product = req.body;
      const result = await singleCategoryCollection.insertOne(product);
      res.send(result);
    });

    // get all product of a seller
    app.get("/myProduct/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await singleCategoryCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/mySeller", async (req, res) => {
      const email = req.query.email;
      const query = {
        sellerEmail: email,
      };
      const buyers = await bookingsCollection.find(query).toArray();
      res.send(buyers);
      console.log(buyers);
    });

    // advertise a item 
    app.put('/advertisement/:id', async(req,res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const option = { upsert: true }
      const recevedDoc = req.body;
      const updatedDoc = { 
        $set: {
          addState: recevedDoc.state
        }
      }
      const result = await singleCategoryCollection.updateOne(filter,updatedDoc,option);
      res.send(result);
      console.log(result);
    })

    // delete a product 
    app.delete('/delete/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await singleCategoryCollection.deleteOne(query);
      res.send(result)
    })
    //--------------- seller dashboard api -------------//


    //--------------- admin dashboard api -------------//
    // get all seller 
    //--------------- admin dashboard api -------------//

    //--------------- manage user role  -------------//
    // check weather a person admin or not api
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const admin = await usersCollection.findOne(query);
      res.send({ isAdmin: admin?.role === "admin" });
    });

    // check weather a person seller or not api
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const seller = await usersCollection.findOne(query);
      res.send({ isSeller: seller?.role === "seller" });
    });

    // check weather a person user or not api
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const buyer = await usersCollection.findOne(query);
      res.send({ isBuyer: buyer?.role === "buyer" });
    });
    //--------------- manage user role  -------------//
  } finally {
  }
}
run().catch(console.log());

app.listen(port, () => {
  console.log(`App is listening on port${port}`);
});
