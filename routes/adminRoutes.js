const express = require("express");
const router = express.Router();
const adminModel = require("../models/adminModel");
const userModel = require("../models/userModel");
const employerModel = require("../models/employerModel");
const jobModel = require( "../models/jobModel" );

// Admin Routes Restricted

const checkEmployerNotLoggedIn = (req, res, next) => {
    if (!req.session.employer) {
        next();
    } else {
        res.redirect('/home');
    }
};

// User Routes Restricted
const checkUserNotLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        next();
    } else {
        res.redirect('/home');
    }
};

//admin login
router.get("/adminLogin", checkEmployerNotLoggedIn, checkUserNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    const errorMessage = req.flash("error");
    res.render("adminLogin", { error: errorMessage, admin, user, employer });
});

router.post("/admin_post", checkEmployerNotLoggedIn, checkUserNotLoggedIn, async (req, res) => {
    const { adminId, password } = req.body;



    if (!adminId || !password) {
        req.flash("error", "Please provide both admin id and password.");
        return res.redirect("/adminLogin");
    }

    try {
        const admin = await adminModel.findOne({ adminId });
        if (!admin) {
            req.flash("error", "Admin not found.");
            return res.redirect("/adminLogin");
        }
        const passwordMatch = await adminModel.findOne({ password });
        if (!passwordMatch) {
            req.flash("error", "Invalid password.");
            return res.redirect("/adminLogin");
        }
        req.session.admin = admin;
        res.redirect("/adminDashboard");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/adminLogin");
    }
});

// admin dashboard
router.get("/adminDashboard", checkUserNotLoggedIn, checkEmployerNotLoggedIn, async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    // Fetch all users from the database
    const users = await userModel.find({});
    const employers = await employerModel.find({});
    const jobs = await  jobModel.find();

    // Pass the users to the adminDashboard template
    res.render("adminDashboard", { user, admin, employer, users, employers, jobs });
});

//Logout
router.get("/adminLogout", checkEmployerNotLoggedIn, checkUserNotLoggedIn, (req, res) => {
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

router.post('/deleteEmployer', async (req, res) => {
    const { email } = req.body;
    try {
        await employerModel.deleteOne({ email });
        console.log('Employer deleted successfully.');
        res.redirect('/adminDashboard'); // Redirect back to the admin dashboard or wherever appropriate
    } catch (error) {
        console.error('Error deleting employer:', error);
        res.status(500).send('Error deleting employer');
    }
});

router.post('/deleteUser', async (req, res) => {
    const { email } = req.body;
    try {
        await userModel.deleteOne({ email });
        console.log('User deleted successfully.');
        res.redirect('/adminDashboard'); // Redirect back to the admin dashboard or wherever appropriate
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user');
    }
});
router.post('/deleteUser', async (req, res) => {
    const { email } = req.body;
    try {
        await userModel.deleteOne({ email });
        console.log('User deleted successfully.');
        res.redirect('/adminDashboard'); // Redirect back to the admin dashboard or wherever appropriate
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user');
    }
});


module.exports = router;