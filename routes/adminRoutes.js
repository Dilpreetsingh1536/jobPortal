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
router.get("/adminDashboard", checkUserNotLoggedIn, checkEmployerNotLoggedIn, checkNotLoggedIn, async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    try {
        let employers = await employerModel.aggregate([{ $sample: { size: 3 } }]);
        let users = await userModel.aggregate([{ $sample: { size: 3 } }]);
        let jobIds = await jobModel.aggregate([{ $sample: { size: 3 } }, { $project: { _id: 1 } }]);
        let jobs = await jobModel.find({ _id: { $in: jobIds.map(j => j._id) } }).populate('employerId', 'employerName');
        let messages = await contactMessageModel.aggregate([{ $sample: { size: 3 } }]);
        
        const jobsPromises = employers.map(employer =>
            jobModel.find({ employerId: employer._id }).lean()
        );
        const jobsForEmployers = await Promise.all(jobsPromises);

        employers = employers.map((employer, index) => ({
            ...employer,
            jobs: jobsForEmployers[index]
        }));

        res.render("adminDashboard", {
            user,
            admin,
            employer,
            users,
            employers,
            jobs,
            messages, 
        });
    } catch (error) {
        console.error('Error fetching data for admin dashboard:', error);
        res.status(500).send('Error loading the admin dashboard');
    }
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
        const employer = await employerModel.findOne({ email });
        if (employer) {
            await jobModel.deleteMany({ employerId: employer._id });
            await employerModel.deleteOne({ _id: employer._id });
            console.log('Employer and related jobs deleted successfully.');
        } else {
            console.log('Employer not found.');
        }
        res.redirect('/adminDashboard');
    } catch (error) {
        console.error('Error deleting employer and related jobs:', error);
        res.status(500).send('Error deleting employer and related jobs');
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
    const { jobId, action, redirectPath } = req.body;
    console.log(jobId, action);

    if (!jobId || !action || (action !== 'approved' && action !== 'rejected')) {
        return res.status(400).send('Invalid request');
    }

    try {
        await jobModel.findByIdAndUpdate(jobId, { status: action });
        // Redirect to the path provided in the form, defaulting to '/allJobs' if not provided
        res.redirect(redirectPath || '/allJobs');
    } catch (error) {
        console.error('Failed to update job status:', error);
        res.status(500).send('Server error');
    }
});



router.get('/allEmployers', checkUserNotLoggedIn, checkEmployerNotLoggedIn, checkNotLoggedIn, async (req, res) => {
    const perPage = 10;
    let page = req.query.page || 1;

    try {
        const employersCount = await employerModel.countDocuments();
        let employers = await employerModel.find({})
                                           .skip((perPage * page) - perPage)
                                           .limit(perPage)
                                           .lean(); // Using .lean() to get plain JavaScript objects

        // Fetch jobs for each employer in parallel
        const jobsPromises = employers.map(employer =>
            jobModel.find({ employerId: employer._id }).lean()
        );
        const jobsForEmployers = await Promise.all(jobsPromises);

        // Attach the jobs to their respective employers
        employers = employers.map((employer, index) => ({
            ...employer,
            jobs: jobsForEmployers[index]
        }));

        res.render('allEmployers', {
            employers,
            current: parseInt(page),
            pages: Math.ceil(employersCount / perPage),
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error('Error fetching all employers:', error);
        res.status(500).send('Error loading all employers');
    }
});


router.get('/allUsers', checkUserNotLoggedIn, checkEmployerNotLoggedIn, checkNotLoggedIn, async (req, res) => {
    const perPage = 10;
    let page = req.query.page || 1;

    try {
        const usersCount = await userModel.countDocuments();
        const users = await userModel.find({})
                                     .skip((perPage * page) - perPage)
                                     .limit(perPage);

        res.render('allUsers', {
            users,
            current: parseInt(page),
            pages: Math.ceil(usersCount / perPage),
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).send('Error loading all users');
    }
});

router.get('/allJobs', async (req, res) => {
    const perPage = 10; // Example pagination setup
    let page = req.query.page || 1;

    try {
        const jobsCount = await jobModel.countDocuments();
        const jobs = await jobModel.find({})
            .populate('employerId', 'employerName')
            .skip((perPage * page) - perPage)
            .limit(perPage);

        res.render('allJobs', {
            jobs,
            current: parseInt(page),
            pages: Math.ceil(jobsCount / perPage),
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
            // pass other necessary variables as needed
        });
    } catch (error) {
        console.error('Error fetching all jobs:', error);
        res.status(500).send('Error loading all jobs');
    }
});


router.get('/allMessages', checkUserNotLoggedIn, checkEmployerNotLoggedIn, checkNotLoggedIn, async (req, res) => {
    const perPage = 10;
    let page = req.query.page || 1;

    try {
        const messagesCount = await contactMessageModel.countDocuments();
        const messages = await contactMessageModel.find({})
                                                  .skip((perPage * page) - perPage)
                                                  .limit(perPage);

        res.render('allMessages', {
            messages, 
            current: parseInt(page),
            pages: Math.ceil(messagesCount / perPage),
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error('Error fetching all messages:', error);
        res.status(500).send('Error loading all messages');
    }
});

module.exports = router;