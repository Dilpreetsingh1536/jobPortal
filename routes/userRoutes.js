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

router.get("/userDashboard", checkEmployerNotLoggedIn, async (req, res) => {
    try {
        const userData = await userModel.findById(req.session.user._id);
        const employer = req.session.employer;
        const user = {
            name: userData.name,
            username: userData.username,
            email: userData.email,
        };
        res.render("userDashboard", { user, employer });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/edit-user-details", checkEmployerNotLoggedIn, async (req, res) => {
    try {
        const userData = await userModel.findById(req.session.user._id);
        const user = {
            name: userData.name,
            username: userData.username,
            email: userData.email,
        };
        res.render("editUserDetails", { user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/update-user-details", checkEmployerNotLoggedIn, async (req, res) => {
    try {
        const { name, username, email } = req.body;
        await userModel.findByIdAndUpdate(req.session.user._id, { name, username, email });
        res.redirect("/userDashboard");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/change-password", (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("changePassword", { user, employer });
});

router.post("/change-password", async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user._id; 

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: "New password and confirm password do not match" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/signup", checkEmployerNotLoggedIn, (req, res) => {
    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("signup", { success: successMessage, error: errorMessage, user, employer });
});

router.post("/signup_post", checkEmployerNotLoggedIn, async (req, res) => {
    const { name, username, email, password, confirmPassword } = req.body;
    try {
        const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            req.flash("error", "Username or email already exists.");
            return res.redirect("/signup");
        }
        if (password !== confirmPassword) {
            req.flash("error", "Passwords do not match.");
            return res.redirect("/signup");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new userModel({ name, username, email, password: hashedPassword });
        await newUser.save();
        req.flash("success", "Signup successful! You can now log in.");
        return res.redirect("/signup");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/signup");
    }
});

router.get("/login", checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("user/login", { error: errorMessage, user, employer });
});

router.post("/login_post", checkEmployerNotLoggedIn, async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await userModel.findOne({ username });
        if (!user) {
            req.flash("error", "Invalid user.");
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

router.get("/forgot-password", checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("forgotPassword", { user, employer });
});

router.post("/send-code", checkEmployerNotLoggedIn, async (req, res) => {
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

router.get("/reset-password", checkEmployerNotLoggedIn, (req, res) => {
    const { email } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("resetPassword", { email, user, employer });
});

router.post("/reset-password", checkEmployerNotLoggedIn, async (req, res) => {
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

router.get("/enter-code", checkEmployerNotLoggedIn, (req, res) => {
    const { email } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("enterCode", { email, user, employer });
});

router.post("/verify-code", checkEmployerNotLoggedIn, async (req, res) => {
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

router.post("/update-password", checkEmployerNotLoggedIn, async (req, res) => {
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

module.exports = router;
