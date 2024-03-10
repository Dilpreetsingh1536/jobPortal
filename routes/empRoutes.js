const express = require("express");
const router = express.Router();
const employerModel = require("../models/employerModel");
const jobModel = require("../models/jobModel");

const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');

// Code Send
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

// User Routes Restricted
const checkUserNotLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        next();
    } else {
        res.redirect('/home');
    }
};

// Admin Routes Restricted
const checkAdminNotLoggedIn = (req, res, next) => {
    if (!req.session.admin) {
        next();
    } else {
        res.redirect('/home');
    }
};

//Employer Dashboard
router.get("/empDashboard", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const employerData = await employerModel.findById(req.session.employer._id);
        const user = req.session.user;
        const admin = req.session.admin;
        const error = req.flash("error");
        const success = req.flash("success");


        const employer = {
            employerName: employerData.employerName,
            employerId: employerData.employerId,
            email: employerData.email,
        };

        const jobs = await jobModel.find({ employerId: employerData._id });
        
        res.render("empDashboard", { user, admin, employer, jobs, error: error, success: success });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/empDashboard");
    }
});

// Edit Emp Details On Dashboard
router.get("/edit-emp-details", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const employerData = await employerModel.findById(req.session.employer._id);
        const employer = {
            employerName: employerData.employerName,
            employerId: employerData.employerId,
            email: employerData.email,
        };
        const user = req.session.user;
        const admin = req.session.admin;

        res.render("editEmpDetails", { employer, admin, user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Update Emp Password On Dashboard
router.post("/update-emp-details", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const { employerName, employerId, email } = req.body;
        const employerIdToUpdate = req.session.employer ? req.session.employer._id : null;

        if (!employerIdToUpdate) {
            return res.status(400).json({ error: "Employer ID is missing from session" });
        }

        const existingEmployer = await employerModel.findOne({ $or: [{ employerId: employerId }, { email: email }] });
        if (existingEmployer && existingEmployer._id.toString() !== employerIdToUpdate) {
            return res.status(400).json({ error: "Employer ID or email already exists" });
        }

        await employerModel.findByIdAndUpdate(employerIdToUpdate, { employerName, employerId, email });
        res.redirect("/empDashboard");
    } catch (error) {
        if (error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(400).json({ error: "Employer ID or email already exists" });
        }
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});


router.get("/empchangepassword", (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    res.render("empChangePassword", { user, admin, employer });
});

router.post("/empchangepassword", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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

//------------------------------------------------------------------------------

//Employer Login

router.get("/empLogin", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    const errorMessage = req.flash("error");
    res.render("empLogin", { error: errorMessage, user, admin, employer });
});

router.post("/empLogin_post", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { employerId, password } = req.body;

    if (!employerId || !password) {
        req.flash("error", "Please provide both employer ID and password.");
        return res.redirect("/empLogin");
    }

    try {
        const employerIdPattern = /^[A-Za-z0-9_]{4,}$/;
        if (!employerIdPattern.test(employerId)) {
            req.flash("error", "Invalid format for Employer ID.");
            return res.redirect("/empLogin");
        }

        const employer = await employerModel.findOne({ employerId });

        if (!employer) {
            req.flash("error", "Employer not found.");
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


//----------------------------------------------------------//

//Employer Signup
router.get("/empSignup", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    res.render("empSignup", { success: successMessage, error: errorMessage, user, admin, employer });
});

router.post("/emp-signup-post", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { employerName, employerId, email, password, confirmPassword } = req.body;

    const nameRegex = /[A-Za-z\s]{2,}/;
    if (!nameRegex.test(employerName)) {
        req.flash("error", "Please enter a valid employer name.");
        return res.redirect("/empsignup");
    }

    const employerIdRegex = /[A-Za-z0-9_]{4,}/;
    if (!employerIdRegex.test(employerId)) {
        req.flash("error", "Please enter a valid employer ID.");
        return res.redirect("/empsignup");
    }

    const existingEmployer = await employerModel.findOne({ employerId });
    if (existingEmployer) {
        req.flash("error", "Employer ID already exists.");
        return res.redirect("/empsignup");
    }

    const existingEmail = await employerModel.findOne({ email });
    if (existingEmail) {
        req.flash("error", "Email already exists.");
        return res.redirect("/empsignup");
    }

    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
    if (!passwordRegex.test(password)) {
        req.flash("error", "Please enter a valid password.");
        return res.redirect("/empsignup");
    }

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect("/empsignup");
    }

    try {
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

router.post("/empLogin_post", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
        return res.redirect("/empsignup");
    }
});

router.get("/empLogout", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
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

//----------------------------------------------------------//


//Emp Password Forgot

router.get("/emp-forgot-password", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");

    const savedEmail = req.cookies['emp_forgot_email'] || "";

    res.render("empforgotPassword", { error: errorMessage, user, admin, employer, savedEmail });
});

router.post("/emp-send-code", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { email } = req.body;

    res.cookie('emp_forgot_email', email, { maxAge: 900000, httpOnly: true });

    if (!email) {
        req.flash("error", "Please provide your email address");
        return res.redirect("/emp-forgot-password");
    }

    try {
        const employer = await employerModel.findOne({ email });
        if (!employer) {
            req.flash("error", "Employer not found");
            return res.redirect("/emp-forgot-password");
        }
        employer.sixDigitCode = sixDigitCode;
        employer.sixDigitCodeExpires = Date.now() + 360000;
        await employer.save();
        sendsixDigitCodeByEmail(email, sixDigitCode);
        res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/emp-forgot-password");
    }
});

//---------------------------------------------------------------//

//Emp Code Verification

router.get("/emp-enter-code", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const savedEmail = req.cookies['emp_forgot_email'] || "";
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");

    res.render("empEnterCode", { error: errorMessage, email: savedEmail, admin, user, employer });
});

router.post("/emp-verify-code", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { email, sixDigitCode } = req.body;

    if (!sixDigitCode) {
        req.flash("error", "Please enter six-digit code");
        return res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}`);
    }

    try {
        const employer = await employerModel.findOne({ email, sixDigitCode, sixDigitCodeExpires: { $gt: Date.now() } });
        if (!employer) {
            req.flash("error", "Incorrect six-digit code. Please try again.");
            return res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}&invalidCode=true`);
        }

        res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}`);
    }
});

//---------------------------------------------------------------------//

//Emp Password Update

router.get("/emp-reset-password", checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const savedEmail = req.cookies['emp_forgot_email'] || "";
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");

    res.render("empResetPassword", { error: errorMessage, email: savedEmail, user, admin, employer });
});


router.post("/emp-update-password", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
        req.flash("error", "Password fields are required.");
        return res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
    } else if (newPassword !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
    } else {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await employerModel.findOneAndUpdate(
                { email },
                { $set: { password: hashedPassword, sixDigitCode: null, sixDigitCodeExpires: null } }
            );

            res.clearCookie('emp_forgot_email');

            return res.redirect("/empLogin");
        } catch (error) {
            console.error(error);
            req.flash("error", "Internal Server Error");
            return res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
        }
    }
});

//------------------------------------------------------------//



module.exports = router;
