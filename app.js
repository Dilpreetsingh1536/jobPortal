const express = require("express");
const userModel = require("./models/userModel.js");
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Server is listening at port 3000");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/home", (req, res) => {
  res.render("home");
});

app.post("/signup_post", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });

    if (existingUser) {
      return res.status(400).send("Username or email already exists.");
    }

    const newUser = new userModel({ username, email, password });

    await newUser.save();

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
