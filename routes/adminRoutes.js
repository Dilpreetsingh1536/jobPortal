const express = require("express");
const router = express.Router();
const adminModel = require("../models/adminModel");
const userModel = require("../models/userModel");
const employerModel = require("../models/employerModel");
const jobModel = require("../models/jobModel");
const contactMessageModel = require("../models/contactMessageModel");

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

const checkNotLoggedIn = (req, res, next) => {
    if (!req.session.user && !req.session.employer && !req.session.admin) {
        res.redirect('/home');
    } else {
        next();
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
router.get("/adminDashboard", checkUserNotLoggedIn, checkEmployerNotLoggedIn, checkNotLoggedIn,  async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const perPage = 10;
    let userPage = req.query.userPage || 1;
    let employerPage = req.query.employerPage || 1;
    let jobPage = req.query.jobPage || 1;
    let messagePage = req.query.messagePage || 1;

    const users = await userModel.find({})
        .skip((perPage * userPage) - perPage)
        .limit(perPage);
    const userCount = await userModel.countDocuments();

    const employers = await employerModel.find({})
        .skip((perPage * employerPage) - perPage)
        .limit(perPage);
    const employerCount = await employerModel.countDocuments();

    const jobs = await jobModel.find({})
        .skip((perPage * jobPage) - perPage)
        .limit(perPage);
    const jobCount = await jobModel.countDocuments();

    const messages = await contactMessageModel.find({})
        .skip((perPage * messagePage) - perPage)
        .limit(perPage);
    const messageCount = await contactMessageModel.countDocuments();

    res.render("adminDashboard", {
        user, admin, employer, users, employers, jobs, messages,
        userCurrent: userPage,
        usersPages: Math.ceil(userCount / perPage),
        employerCurrent: employerPage,
        employersPages: Math.ceil(employerCount / perPage),
        jobCurrent: jobPage,
        jobsPages: Math.ceil(jobCount / perPage),
        messageCurrent: messagePage,
        messagesPages: Math.ceil(messageCount / perPage)
    });
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
        res.redirect('/adminDashboard');
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
        res.redirect('/adminDashboard');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user');
    }
});

router.post('/deleteJob', async (req, res) => {
    const { jobId } = req.body;
    try {
        await jobModel.findByIdAndDelete(jobId);
        console.log('Job deleted successfully.');
        res.redirect('/adminDashboard');
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).send('Error deleting job');
    }
});

router.post('/deleteMessage', async (req, res) => {
    const { messageId } = req.body;
    try {
        await contactMessageModel.findByIdAndDelete(messageId);
        console.log('Message deleted successfully.');
        res.redirect('/adminDashboard');
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).send('Error deleting message');
    }
});



router.post('/admin/updateJobStatus', async (req, res) => {
    const { jobId, action } = req.body;
    console.log(jobId, action);

    // Validate input
    if (!jobId || !action || (action !== 'approved' && action !== 'rejected')) {
        return res.status(400).send('Invalid request');
    }

    try {
        await jobModel.findByIdAndUpdate(jobId, { status: action });
        res.redirect('/adminDashboard');
    } catch (error) {
        console.error('Failed to update job status:', error);
        res.status(500).send('Server error');
    }
});


module.exports = router;