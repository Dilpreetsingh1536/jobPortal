const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const empRoutes = require("./routes/empRoutes");
const adminRoutes = require("./routes/adminRoutes");
const jobRoutes = require("./routes/jobRoutes");

const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(flash());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.listen(3001, () => {
  console.log("Server is listening at port 3001");
});

app.set("views", [
  path.join(__dirname, "views"),
  path.join(__dirname, "views", "user"),
  path.join(__dirname, "views", "employer"),
  path.join(__dirname, "views", "job"),
  path.join(__dirname, "views", "admin"),
  path.join(__dirname, "views", "partials")
]);

/* SESSION */
const uri = "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/?retryWrites=true&w=majority";
const accountSessionStore = MongoStore.create({
  mongoUrl: uri,
  dbName: "career_connect_session",
  collectionName: "sessions",
});

app.use(session({
  secret: "A secret key to sign the cookie",
  resave: false,
  saveUninitialized: false,
  store: accountSessionStore,
}));


/* HOME */
app.get("/home", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;
  const admin = req.session.admin;
  res.render("home", { user, admin, employer });
});

/*User Search*/
app.get('/userSearch', (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;
  const admin = req.session.admin;
  res.render("userSearch", { user, employer, admin });
})

/* contactUs */
app.get("/contactUs", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;
  const admin = req.session.admin;
  res.render("contactUs", { user, employer, admin });
});

/*Abous us*/
app.get('/aboutUs', (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render('aboutUs', { user, employer, admin });
});



app.use("/", userRoutes);
app.use("/", empRoutes);
app.use("/", adminRoutes);
app.use("/", jobRoutes);


