const express = require("express");
const router = express.Router();
const employerModel = require("../models/employerModel");
const jobModel = require("../models/jobModel");
const messageModel = require("../models/messageModel");
const adminModel = require("../models/adminModel");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const userModel = require("../models/userModel");
const multer = require('multer');

router.use(express.static(__dirname+ "/public")); 
router.use("/public", express.static("public"));

const stripe = require('stripe')('sk_test_51P3kykCqjFE2iT0kclnF74C7Rwz4QW85PSRx1CLrAKwI1lNfX3jQFr0L0wsSy4aW9YkwBNxEMocu95rn9t5TedlI00bag4Vj1H');


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

const checkLoggedIn = (req, res, next) => {
    if (req.session.employer) {
        next();
    } else {
        res.redirect('/empLogin');
    }
};

//Employer Dashboard
router.get("/empDashboard", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const employerData = await employerModel.findById(req.session.employer._id);
        const employerId = req.session.employer;

        const messageCount = await messageModel.countDocuments({ recipientId: employerId });


        const user = req.session.user;
        const admin = req.session.admin;
        const error = req.flash("error");
        const success = req.flash("success");


        const employer = {
            logo: employerData.logo,
            employerName: employerData.employerName,
            employerId: employerData.employerId,
            email: employerData.email,
            membership : employerData.membershipPlan,
        };


        let adminDetails = await adminModel.findOne();

        const sortedMessages = employerData.messages ? employerData.messages
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map(message => ({
                ...message.toObject(),
                adminUniqueId: adminDetails ? adminDetails.adminId : 'Admin not found',
            })) : [];

        console.log(sortedMessages);

        const jobs = await jobModel.find({ employerId: employerData._id });

        res.render("empDashboard", { user, admin, employer, jobs, error: error, success: success, messageCount, messages: sortedMessages });
    } catch (error) {
        console.error(error);
        res.redirect("/empDashboard");
    }
});

router.post('/deleteMessageForEmployer/:messageId', async (req, res) => {
    const messageId = req.params.messageId;
    const employerId = req.session.employer._id;

    try {
        await employerModel.updateOne(
            { _id: employerId },
            { $pull: { messages: { _id: messageId } } }
        );

        req.flash('success', 'Message deleted successfully.');
        res.redirect('/empDashboard');
    } catch (error) {
        console.error('Failed to delete message for employer:', error);
        res.redirect('/empDashboard');
    }
});


// Edit Emp Details On Dashboard
router.get("/edit-emp-details", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
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
    }
});


router.get("/empchangepassword", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, (req, res) => {
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
        return res.redirect(`/emp-enter-code?email=${encodeURIComponent(email)}`);
    }
});

//---------------------------------------------------------------------//

//Emp Password Update
function checkEmployerVerification(req, res, next) {
    // Check if verification flag is set in the session
    if (req.session.isEmployerVerified) {
        next();
    } else {
        // Redirect them to the verification code entry page if the flag isn't set
        req.flash("error", "Please verify your code first.");
        res.redirect("/emp-enter-code");
    }
}

router.get("/emp-reset-password", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkEmployerVerification, (req, res) => {
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
            return res.redirect(`/emp-reset-password?email=${encodeURIComponent(email)}`);
        }
    }
});

//------------------------------------------------------------//

//Search Job Seekers 
router.get('/jobSeekersPage', checkAdminNotLoggedIn, checkUserNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const users = await userModel.find({}, 'name email logo');

        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;


        res.render('jobSeekersPage', { users, user, employer, admin });
    } catch (error) {
        console.error(error);
        res.redirect('/jobSeekersPage');
    }
});

// Set user profile session
router.post('/viewUsrProfile', (req, res) => {
    const { userId } = req.body;
    req.session.userProfileId = userId;
    res.redirect('/jobSeekersProfile');
});

// Render user profile page
router.get('/jobSeekersProfile', checkAdminNotLoggedIn, checkUserNotLoggedIn,checkLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userProfileId;
        const usr = await userModel.findById(userId);

        if (!usr) {
            req.flash('error', 'Job Seeker not found.');
            return res.redirect('/jobSeekersPage');
        }

        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        res.render('jobSeekersProfile', { usr, user, employer, admin });
    } catch (error) {
        console.error(error);
        res.redirect('/jobSeekersPage');
    }
});


// Message send to job seeker

router.get('/jobSeekerMsg', checkAdminNotLoggedIn, checkUserNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userProfileId;
        const { success, error } = req.query;


        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const usr = await userModel.findById(userId);

        res.render('jobSeekerMsg', { usr, user, employer, admin, success, error });
    } catch (error) {
        console.error(error);
        res.redirect('/jobSeekersProfile');
    }
});

// Message Post route
router.post('/sendEmpMessage', async (req, res) => {
    try {

        const { message } = req.body;
        const senderId = req.session.employer;
        const recipientId = req.session.userProfileId;

        const newMessage = new messageModel({
            senderId: senderId,
            senderModel: 'employerModel',
            recipientId: recipientId,
            recipientModel: 'userModel',
            message: message
        });

        await newMessage.save();

        res.redirect('/jobSeekerMsg?success=Message sent successfully');
    } catch (error) {
        console.error(error);
        res.redirect('/jobSeekerMsg?error=Error sending message');
    }
});

//View Message
router.get('/viewMsg', checkAdminNotLoggedIn, checkUserNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const senderName = req.params.senderName;
        const employerId = req.session.employer;

        const user = req.session.user;
        const admin = req.session.admin;
        const employer = req.session.employer;



        const messages = await messageModel.find({
            recipientId: employerId,
            senderModel: 'userModel',
            'senderId.name': senderName
        }).populate('senderId');



        res.render('viewMsg', { messages, senderName, user, admin, employer });
    } catch (error) {
        console.error(error);
        res.redirect('/empDashboard');
    }
});


//Reply Message

router.post('/replyMessage', async (req, res) => {
    try {
        const { messageId, reply } = req.body;

        const message = await messageModel.findById(messageId);

        message.reply = reply;
        await message.save();

        res.redirect('/viewMsg');
    } catch (error) {
        console.error(error);
        res.redirect('/viewMsg');
    }
});


//Sent Messages
router.get('/sentMsg', checkAdminNotLoggedIn, checkUserNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const employerId = req.session.employer;

        const user = req.session.user;
        const admin = req.session.admin;
        const employer = req.session.employer;

        const messages = await messageModel.find({
            senderId: employerId,
            senderModel: 'employerModel'
        }).populate({
            path: 'recipientId',
            model: 'userModel',
            select: 'name'
        });

        res.render('sentMsg', { messages, user, admin, employer });
    } catch (error) {
        console.error(error);
        res.redirect('/empDashboard');
    }
});


//Delete Message

router.post('/deleteMessage/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        await messageModel.findByIdAndDelete(messageId);

        res.redirect('/sentMsg');
    } catch (error) {
        console.error(error);
    }
});

//Delete Message

router.post('/deleteMsg/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        await messageModel.findByIdAndDelete(messageId);

        res.redirect('/viewMsg');
    } catch (error) {
        console.error(error);
    }
});

router.post('/deleteSentMsg/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        await messageModel.findByIdAndDelete(messageId);

        res.redirect('/sentMsg');
    } catch (error) {
        console.error(error);
    }
});

//Update emp profile logo
const store = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const images = multer({ storage: store });

const fs = require('fs');

router.post('/uploadEmpLogo', images.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const employerId = req.session.employer._id;

        const filePath = req.file.filename;

        const employer = await employerModel.findById(employerId);
        if (!employer) {
            fs.unlinkSync(filePath);
            console.error('Error uploading logo:', error);
            res.redirect('/empDashboard');
        }

        employer.logo = filePath;

        await employer.save();

        res.redirect('/empDashboard');
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.redirect('/empDashboard');
    }
});


// Delete logo
router.post('/deleteEmpLogo', async (req, res) => {
    try {
        const employerId = req.session.employer._id;
        await employerModel.findByIdAndUpdate(employerId, { $unset: { logo: "" } });
        res.redirect('/empDashboard');
    } catch (error) {
        console.error("Error deleting logo:", error);
        res.redirect("/empDashboard");
    }
});



router.get("/allJobs", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3; 
        const skip = (page - 1) * limit;
        
        const employerData = await employerModel.findById(req.session.employer._id);
        const totalJobs = await jobModel.countDocuments({ employerId: employerData._id });
        const pageCount = Math.ceil(totalJobs / limit);
        
        const jobs = await jobModel.find({ employerId: employerData._id })
                                   .skip(skip)
                                   .limit(limit);
        
        res.render("allJobs", { jobs, user: req.session.user, admin: req.session.admin, employer: req.session.employer, pageCount, currentPage: page });
    } catch (error) {
        console.error("Error fetching all jobs:", error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/empDashboard");
    }
});


router.get("/allApplications", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const employer = req.session.employer;
        const user = req.session.user;
        const admin = req.session.admin;

        const employerData = await employerModel.findById(req.session.employer._id);
        const jobs = await jobModel.find({ employerId: employerData._id });

        res.render("allApplications", { jobs, user, admin, employer });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/empDashboard");
    }
});
router.get("/adminAllMessages", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10;
        const employerId = req.session.employer._id;
        
        const employer = await employerModel.findById(employerId);
        if (!employer || !employer.messages) {
            req.flash("info", "No messages available.");
            return res.redirect("/employerDashboard");
        }
        let adminDetails = await adminModel.findOne();
        const skip = (page - 1) * pageSize; 

        const totalMessages = employer.messages.length;
        const totalPages = Math.ceil(totalMessages / pageSize);

        const messages = employer.messages
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(skip, skip + pageSize)
            .map(message => ({
                ...message.toObject(),
                adminUniqueId: adminDetails ? adminDetails.adminId : 'Admin not found',
                createdAtFormatted: message.createdAt.toDateString(),
            }));

        res.render("adminAllMessages", {
            messages,
            currentPage: page,
            totalPages,
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        req.flash("error", "Internal Server Error");
        res.redirect("/employerDashboard");
    }
});

router.get("/empMembership", checkUserNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, (req, res) => {

    const currentPlan = req.session.employer.membershipPlan;

    res.render("empMembership", { 
        user: req.session.user,
        employer: req.session.employer,
        admin: req.session.admin,
        currentPlan: currentPlan, });
});

router.post('/create-payment-intent', async (req, res) => {
    const { paymentMethodId, plan } = req.body;
    let amount;

    switch (plan) {
        case 'Starter':
            return res.json({ success: true, message: "Free plan selected, no payment needed." });
        case 'Pro':
            amount = 1599;
            break;
        case 'Ultimate':
            amount = 2999;
            break;
        default:
            return res.status(400).send({ error: 'Invalid plan selected.' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'cad',
            description: `${plan} Membership Plan Payment`,
            payment_method: paymentMethodId,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });
        
        res.json({ success: true, paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

router.post('/update-membership-plan', async (req, res) => {
    const employerId = req.session.employer._id;
    const { plan } = req.body;

    if (!['Starter', 'Pro', 'Ultimate'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    try {
        const updatedEmployer = await employerModel.findByIdAndUpdate(employerId, {
            $set: { membershipPlan: plan }
        }, { new: true });

        if (!updatedEmployer) {
            return res.status(404).json({ error: 'Employer not found.' });
        }

        req.session.employer.membershipPlan = plan;

        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ error: 'Failed to update session.' });
            }
            res.json({ success: true, message: `Membership plan updated to ${plan}.` });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update membership plan.' });
    }
});


module.exports = router;
