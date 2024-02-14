const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');


const sixDigitCode = Math.floor(100000 + Math.random() * 900000);

const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
        user: 'careerconnect.portal@outlook.com',
        pass: 'asksuimqzesswqdz'
    }
});

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

const checkEmployerNotLoggedIn = (req, res, next) => {
    if (!req.session.employer) {
        next();
    } else {
        res.redirect('/home');
    }
};

//Dashboard
router.get("/userDashboard", checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("userDashboard", { user, employer });

});

//---------------------------------------------------------//

//User Signup
router.get("/signup", checkEmployerNotLoggedIn, (req, res) => {
    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const employer = req.session.employer;

    res.render("signup", { success: successMessage, error: errorMessage, user, employer });
});


router.post("/signup_post", checkEmployerNotLoggedIn, async (req, res) => {
    const { name, username, email, password, confirmPassword } = req.body;

    const nameRegex = /[A-Za-z\s]{2,}/;
    if (!nameRegex.test(name)) {
        req.flash("error", "Please enter a valid name.");
        return res.redirect("/signup");
    }

    const usernameRegex = /[A-Za-z0-9_]{4,}/;
    if (!usernameRegex.test(username)) {
        req.flash("error", "Please enter a valid username.");
        return res.redirect("/signup");
    }

    const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        req.flash("error", "Username or email already exists.");
        return res.redirect("/signup");
    }

    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
    if (!passwordRegex.test(password)) {
        req.flash("error", "Please enter a valid password.");
        return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect("/signup");
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new userModel({ name, username, email, password: hashedPassword });
        await newUser.save();
        req.flash("success", "Signup successful! You can now log in.");
        return res.redirect("/login");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/signup");
    }
});




//-------------------------------------------------------------------------------------//

//User Login
router.get("/login", checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("user/login", { error: errorMessage, user, employer });
});

router.post("/login_post", checkEmployerNotLoggedIn, async (req, res) => {
    const { username, password } = req.body;

    const usernameRegex = /^[A-Za-z0-9_]{4,}$/;

    if (!username || !password) {
        req.flash("error", "Please provide both username and password.");
        return res.redirect("/login");
    }

    if (!usernameRegex.test(username)) {
        req.flash("error", "Invalid username format.");
        return res.redirect("/login");
    }

    try {
        const user = await userModel.findOne({ username });
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect("/login");
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            req.flash("error", "Invalid password.");
            return res.redirect("/login");
        }
        req.session.user = user;
        res.redirect("/userDashboard");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/login");
    }
});

//------------------------------------------------------------------//

//Logout
router.get("/logout", checkEmployerNotLoggedIn, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            req.flash("error", "Logout failed. Please try again.");
            res.redirect("/");
        } else {
            res.redirect("/home");
        }
    });
});
//-------------------------------------------------------------------//

//User Password Forgot

router.get("/forgot-password", checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    const savedEmail = req.cookies['user_forgot_email'] || "";
    res.render("forgotPassword", { error: errorMessage, user, savedEmail, employer });
});

router.post("/send-code", checkEmployerNotLoggedIn, async (req, res) => {
    const { email } = req.body;

    res.cookie('user_forgot_email', email, { maxAge: 900000, httpOnly: true });

    if (!email) {
        req.flash("error", "Please provide your email address");
        return res.redirect("/forgot-password");
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/forgot-password");
        }
        user.sixDigitCode = sixDigitCode;
        user.sixDigitCodeExpires = Date.now() + 3600000;
        await user.save();
        sendsixDigitCodeByEmail(email, sixDigitCode);
        res.redirect(`/enter-code?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
    }
});

//-----------------------------------------------------------------//

//User Code Verification
router.get("/enter-code", checkEmployerNotLoggedIn, (req, res) => {
    const savedEmail = req.cookies['user_forgot_email'] || "";
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("enterCode", { error: errorMessage, email:savedEmail, user, employer });
});

router.post("/verify-code", checkEmployerNotLoggedIn, async (req, res) => {
    const { email, sixDigitCode } = req.body;
    if (!sixDigitCode) {
        req.flash("error", "Please enter six-digit code");
        return res.redirect(`/enter-code?email=${encodeURIComponent(email)}`);
    }

    try {
        const user = await userModel.findOne({ email, sixDigitCode, sixDigitCodeExpires: { $gt: Date.now() } });
        if (!user) {
            req.flash("error", "Incorrect six-digit code. Please try again.");
            return res.redirect(`/enter-code?email=${encodeURIComponent(email)}&invalidCode=true`);
        }
        res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
        req.flash("error", "Internal Server Error");
        return res.redirect(`/enter-code?email=${encodeURIComponent(email)}`);
    }
});

//----------------------------------------------------------------------------------//

//User Password Update
router.get("/reset-password", checkEmployerNotLoggedIn, (req, res) => {
    const savedEmail = req.cookies['user_forgot_email'] || "";
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("resetPassword", { error: errorMessage, email:savedEmail, user, employer });
});

router.post("/update-password", checkEmployerNotLoggedIn, async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword) {
        req.flash("error", "Password fields are required.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    } else if (newPassword !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    } else {
        try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await userModel.findOneAndUpdate(
            { email },
            { $set: { password: hashedPassword, sixDigitCode: null, sixDigitCodeExpires: null } }
        );
        res.clearCookie('user_forgot_email');
        res.redirect("/login");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
            return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }
}
});
//----------------------------------------------------------------//
module.exports = router;
