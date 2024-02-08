const express = require("express");
const userModel = require("./models/userModel.js");
const employerModel = require("./models/employerModel.js");
const app = express();
const bodyParser = require("body-parser");
const flash = require('connect-flash');
app.use(flash());
const session = require('express-session');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo')
const nodemailer = require('nodemailer');
const path = require("path");

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Server is listening at port 3000");
});

app.set("views", [
  path.join(__dirname, "views"),
  path.join(__dirname, "views", "user"),
  path.join(__dirname, "views", "employee"),
  path.join(__dirname, "views", "partials")
]);

/*SESSION*/
const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/user_Model?retryWrites=true&w=majority";

const accountSessionStore = MongoStore.create({
  mongoUrl: uri,
  dbName: "career_Connect",
  collectionName: "sessions",
});

app.use(
  session({
    secret: "A secret key to sign the cookie",
    resave: false,
    saveUninitialized: false,
    store: accountSessionStore,
  })
);

//-----------------------------------------------//

/*HOME*/

app.get("/home", (req, res) => {

  const user = req.session.user;

  const employer = req.session.employer;


  res.render("home", { user, employer });
});

//-----------------------------------------------------//

/*USER*/
const transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: 'careerconnect.portal@outlook.com',
    pass: 'asksuimqzesswqdz'
  }
});


app.get("/userDashboard", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("userDashboard", { user, employer });
});


app.get("/signup", (req, res) => {
  const successMessage = req.flash('success');
  const errorMessage = req.flash('error');
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("signup", { success: successMessage, error: errorMessage, user, employer });
});

app.post("/signup_post", async (req, res) => {
  const { name, username, email, password, confirmPassword } = req.body;

  try {
    const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });

    if (existingUser) {
      req.flash('error', 'Username or email already exists.');
      return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect("/signup");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({ name, username, email, password: hashedPassword });
    await newUser.save();

    req.flash('success', 'Signup successful! You can now log in.');
    return res.redirect("/signup");
  } catch (error) {
    console.error(error);
    req.flash('error', 'Internal Server Error');
    return res.redirect("/signup");
  }
});

app.get("/login", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;


  const errorMessage = req.flash('error');
  res.render("user/login", { error: errorMessage, user, employer });
});

app.post("/login_post", async (req, res) => {
  const { username, password } = req.body;


  try {
    const user = await userModel.findOne({ username });

    if (!user) {
      req.flash('error', 'Invalid user.');
      return res.redirect("/login");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      req.flash('error', 'Invalid password.');
      return res.redirect("/login");
    }

    req.session.user = user;

    res.redirect("/userDashboard");
  } catch (error) {
    console.error(error);
    req.flash('error', 'Internal Server Error');
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Logout failed. Please try again.');
      res.redirect("/");
    } else {
      res.redirect("/home");
    }
  });
});


app.get("/forgot-password", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("forgotPassword", { user, employer });
});

app.post("/send-code", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).send("User not found");
    }


    user.sixDigitCode = sixDigitCode;
    user.sixDigitCodeExpires = Date.now() + 3600000;
    await user.save();

    sendsixDigitCodeByEmail(email, sixDigitCode);

    res.redirect(`/enter-code?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});


const sixDigitCode = Math.floor(100000 + Math.random() * 900000);

function sendsixDigitCodeByEmail(email) {
  const mailOptions = {
    from: 'careerconnect.portal@outlook.com',
    to: email,
    subject: 'Password Reset Code',
    text: `Your password reset code is: ${sixDigitCode}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}



app.get("/reset-password", (req, res) => {
  const { email } = req.query;
  const user = req.session.user;
  const employer = req.session.employer;

  res.render("resetPassword", { email, user, employer });
});


app.post("/reset-password", async (req, res) => {
  const { email, sixDigitCode, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("Passwords do not match.");
  }

  try {
    const user = await userModel.findOne({
      email,
      sixDigitCode,
      sixDigitCodeExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.redirect("/forgot-password?invalidCode=true");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (user.sixDigitCodeExpires && user.sixDigitCodeExpires > Date.now()) {
      await userModel.findOneAndUpdate(
        { email },
        {
          $set: {
            password: hashedPassword,
            sixDigitCode: null,
            sixDigitCodeExpires: null,
          },
        }
      );

      res.redirect("/login");
    } else {
      return res.status(400).send("Code has expired. Please request a new one.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/enter-code", (req, res) => {
  const { email } = req.query;
  const user = req.session.user;
  const employer = req.session.employer;

  res.render("enterCode", { email, user, employer });
});

app.post("/verify-code", async (req, res) => {
  const { email, sixDigitCode } = req.body;

  try {
    const user = await userModel.findOne({ email, sixDigitCode, sixDigitCodeExpires: { $gt: Date.now() } });

    if (!user) {
      return res.redirect(`/enter-code?email=${encodeURIComponent(email)}&invalidCode=true`);
    }

    res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/update-password", async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("Passwords do not match.");
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await userModel.findOneAndUpdate(
      { email },
      { $set: { password: hashedPassword, sixDigitCode: null, sixDigitCodeExpires: null } }
    );

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//---------------------------------------------------------------------------//

/*EMPLOYER*/

app.get("/empLogin", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;

  const errorMessage = req.flash('error');
  res.render("empLogin", { error: errorMessage, user, employer });
});

app.get("/empSignup", (req, res) => {
  const successMessage = req.flash('success');
  const errorMessage = req.flash('error');
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("empSignup", { success: successMessage, error: errorMessage, user,employer });
});

app.post("/emp-signup-post", async (req, res) => {
  const { employerName, employerId, email, password, confirmPassword } = req.body;

  try {
    const existingEmployer = await employerModel.findOne({ $or: [{ employerId }, { email }] });

    if (existingEmployer) {
      req.flash('error', 'Employer ID or email already exists.');
      return res.redirect("/empSignup");
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect("/empSignup");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployer = new employerModel({ employerName, employerId, email, password: hashedPassword });

    await newEmployer.save();

    req.flash('success', 'Employer signup successful! You can now log in.');
    return res.redirect("/empSignup");
  } catch (error) {
    console.error(error);
    req.flash('error', 'Internal Server Error');
    return res.redirect("/empSignup");
  }
});

app.post("/empLogin_post", async (req, res) => {
  const { username, password } = req.body;

  try {
    const employer = await employerModel.findOne({ username });

    if (!employer) {
      req.flash('error', 'Invalid employer.');
      return res.redirect("/empLogin");
    }

    const passwordMatch = await bcrypt.compare(password, employer.password);

    if (!passwordMatch) {
      req.flash('error', 'Invalid password.');
      return res.redirect("/empLogin");
    }

    req.session.employer = employer;

    res.redirect("/empDashboard");
  } catch (error) {
    console.error(error);
    req.flash('error', 'Internal Server Error');
    res.redirect("/empLogin");
  }
});

app.get("/empDashboard", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("empDashboard", { user, employer });
});

app.get("/empLogout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Logout failed. Please try again.');
      res.redirect("/");
    } else {
      res.redirect("/home");
    }
  });
});

app.get("/emp-forgot-password", (req, res) => {
  const user = req.session.user;
  const employer = req.session.employer;


  res.render("empforgotPassword", { user, employer });
});

app.post("/emp-send-code", async (req, res) => {
  const { email } = req.body;

  try {
    const employer = await employerModel.findOne({ email });

    if (!employer) {
      return res.status(404).send("Employer not found");
    }


    employer.sixDigitCode = sixDigitCode;
    employer.sixDigitCodeExpires = Date.now() + 3600000;
    await employer.save();

    sendsixDigitCodeByEmail(email, sixDigitCode);

    res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/emp-enter-code", (req, res) => {
  const { email } = req.query;
  const user = req.session.user;
  const employer = req.session.employer;

  res.render("empEnterCode", { email, user, employer });
});

app.post("/emp-verify-code", async (req, res) => {
  const { email, sixDigitCode } = req.body;

  try {
    const employer = await employerModel.findOne({ email, sixDigitCode, sixDigitCodeExpires: { $gt: Date.now() } });

    if (!employer) {
      return res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}&invalidCode=true`);
    }

    res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/emp-update-password", async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("Passwords do not match.");
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await employerModel.findOneAndUpdate(
      { email },
      { $set: { password: hashedPassword, sixDigitCode: null, sixDigitCodeExpires: null } }
    );

    res.redirect("/empLogin");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/emp-reset-password", (req, res) => {
  const { email } = req.query;
  const user = req.session.user;
  const employer = req.session.employer;

  res.render("empResetPassword", { email, user, employer });
});