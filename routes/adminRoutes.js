const express = require("express");
const router = express.Router();
const adminModel = require("../models/adminModel");


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
router.get("/adminDashboard", checkUserNotLoggedIn, checkEmployerNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    res.render("adminDashboard", { user, admin, employer });
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
module.exports = router;