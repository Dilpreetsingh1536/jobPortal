const express = require("express");
const router = express.Router();
const employerModel = require("../models/employerModel");
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

const checkUserNotLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        next();
    } else {
        res.redirect('/home');
    }
};

router.get("/empDashboard", checkUserNotLoggedIn, async (req, res) => {
    try {
        const employerData = await employerModel.findById(req.session.employer._id);
        const user = req.session.user;
        const employer = {
            employerName: employerData.employerName,
            employerId: employerData.employerId,
            email: employerData.email,
        };
        res.render("empDashboard", { user, employer });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/edit-emp-details", checkUserNotLoggedIn, async (req, res) => {
    try {
        const employerData = await employerModel.findById(req.session.employer._id);
        const employer = {
            employerName: employerData.employerName,
            employerId: employerData.employerId,
            email: employerData.email,
        };
        const user = req.session.user;
        res.render("editEmpDetails", { employer, user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});


router.post("/update-emp-details", checkUserNotLoggedIn, async (req, res) => {
    try {
        const { employerName, employerId, email } = req.body;
        await employerModel.findByIdAndUpdate(req.session.employer._id, { employerName, employerId, email });
        res.redirect("/empDashboard");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/empchangepassword", (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("empChangePassword", { user, employer });
});

router.post("/empchangepassword", checkUserNotLoggedIn, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const employerId = req.session.employer._id;

    try {
        const employer = await employerModel.findById(employerId);
        if (!employer) {
            return res.status(404).json({ error: "Employer not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, employer.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: "New password and confirm password do not match" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        employer.password = hashedPassword;
        await employer.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get("/empLogin", checkUserNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("empLogin", { error: errorMessage, user, employer });
});

router.get("/empSignup", checkUserNotLoggedIn, (req, res) => {
    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("empSignup", { success: successMessage, error: errorMessage, user, employer });
});

router.post("/emp-signup-post", checkUserNotLoggedIn, async (req, res) => {
    const { employerName, employerId, email, password, confirmPassword } = req.body;
    try {
        const existingEmployer = await employerModel.findOne({ $or: [{ employerId }, { email }] });
        if (existingEmployer) {
            req.flash("error", "Employer ID or email already exists.");
            return res.redirect("/empSignup");
        }
        if (password !== confirmPassword) {
            req.flash("error", "Passwords do not match.");
            return res.redirect("/empSignup");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newEmployer = new employerModel({ employerName, employerId, email, password: hashedPassword });
        await newEmployer.save();
        req.flash("success", "Employer signup successful! You can now log in.");
        return res.redirect("/empSignup");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/empSignup");
    }
});

router.post("/empLogin_post", checkUserNotLoggedIn, async (req, res) => {
    const { employerId, password } = req.body; 
    try {
        const employer = await employerModel.findOne({ employerId });
        if (!employer) {
            req.flash("error", "Invalid employer.");
            return res.redirect("/empLogin");
        }
        const passwordMatch = await bcrypt.compare(password, employer.password);
        if (!passwordMatch) {
            req.flash("error", "Invalid password.");
            return res.redirect("/empLogin");
        }
        req.session.employer = employer;
        res.redirect("/empDashboard");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/empLogin");
    }
});

router.get("/empLogout", checkUserNotLoggedIn, (req, res) => {
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

router.get("/emp-forgot-password", checkUserNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("empforgotPassword", { user, employer });
});

router.post("/emp-send-code", checkUserNotLoggedIn, async (req, res) => {
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

router.get("/emp-enter-code", checkUserNotLoggedIn, (req, res) => {
    const { email } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("empEnterCode", { email, user, employer });
});

router.post("/emp-verify-code", checkUserNotLoggedIn, async (req, res) => {
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

router.post("/emp-update-password", checkUserNotLoggedIn, async (req, res) => {
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

router.get("/emp-reset-password", checkUserNotLoggedIn, (req, res) => {
    const { email } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    res.render("empResetPassword", { email, user, employer });
});

module.exports = router;
