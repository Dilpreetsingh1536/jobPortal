const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const jobModel = require("../models/jobModel");
const adminModel = require("../models/adminModel");
const messageModel = require("../models/messageModel");
const employerModel = require("../models/employerModel");
const multer = require('multer');
const fs = require('fs');

router.use(express.static(__dirname + "/public"));
router.use("/public", express.static("public"));


const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const ContactMessageModel = require('../models/contactMessageModel');
const Application = require('../models/applicationModel');


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



// Employer Route Restricted
const checkEmployerNotLoggedIn = (req, res, next) => {
    if (!req.session.employer) {
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
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// If Education not in session route Restricted
const checkEducationSession = (req, res, next) => {
    if (req.session.editEducationId) {
        next();
    } else {
        res.redirect('/home');
    }
};

// If Experienece not in session route Restricted
const checkExperienceSession = (req, res, next) => {
    if (req.session.editExperienceId) {
        next();
    } else {
        res.redirect('/home');
    }
};

// User Dashboard
router.get("/userDashboard", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async(req, res) => {
    try {
        const userData = await userModel.findById(req.session.user._id);
        const userId = req.session.user;

        const employer = req.session.employer;
        const admin = req.session.admin;

        const likedJobs = [];
        for (const jobId of userData.likedJobs) {
            const job = await jobModel.findById(jobId).populate('employerId', 'employerName');
            if (job) {
                likedJobs.push({
                    jobTitle: job.jobTitle,
                    employerName: job.employerId.employerName,
                    sector: job.sector,
                    city: job.city,
                    province: job.province,
                    salary: job.salary,
                    street: job.street
                });
            }
        }

        const appliedJobs = [];
        const userAppliedJobs = [];
        for (const jobId of userData.appliedJobs) {
            const application = await Application.findOne({ jobId: jobId, userId: req.session.user._id })
                                    .populate({
                                        path: 'jobId',
                                        populate: { path: 'employerId', select: 'employerName' }
                                    });
            if (application && application.jobId) {
                appliedJobs.push({
                    jobTitle: application.jobId.jobTitle,
                    employerName: application.jobId.employerId.employerName,
                    sector: application.jobId.sector,
                    city: application.jobId.city,
                    province: application.jobId.province,
                    salary: application.jobId.salary,
                    street: application.jobId.street,
                    decision: application.decision 
                });
                userAppliedJobs.push(application.jobId._id.toString());
            }
        }


    
        let adminDetails = await adminModel.findOne();
        const messageCount = await messageModel.countDocuments({ recipientId: userId });

        const sortedMessages = userData.messages && Array.isArray(userData.messages) ? userData.messages
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map(message => ({
                ...message.toObject(),
                adminUniqueId: adminDetails ? adminDetails.adminId : 'Admin not found',
            })) : [];

        if (!userData) {
            req.flash("error", "User not found");
            return res.redirect("/login");
        }

        let sortedExperiences = [];
        let sortedEducations = [];

        if (userData.experience && userData.experience.length > 0) {
            sortedExperiences = userData.experience.sort((a, b) => b.expStartDate.getTime() - a.expStartDate.getTime()).slice(0, 3);
        }

        if (userData.education && userData.education.length > 0) {
            sortedEducations = userData.education.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()).slice(0, 3);
        }
        const user = {
            logo: userData.logo,
            name: userData.name,
            username: userData.username,
            email: userData.email,
            education: userData.education,
            experience: userData.experience,
            resume: userData.resume,
        };

        res.render("userDashboard", {
            user,
            sortedExperiences,
            sortedEducations,
            likedJobs,
            messages: sortedMessages,
            admin,
            employer,
            messageCount,
            appliedJobs
        });
    } catch (error) {
        console.error("Error fetching user dashboard:", error);
        res.redirect("/userDashboard");
    }
});


router.post('/deleteMessage/:messageId', async (req, res) => {
    const messageId = req.params.messageId;
    const userId = req.session.user._id;

    try {
        await userModel.updateOne(
            { _id: userId },
            { $pull: { messages: { _id: messageId } } }
        );

        req.flash('success', 'Message deleted successfully.');
        res.redirect('/userDashboard');
    } catch (error) {
        console.error('Failed to delete message:', error);
        req.flash('error', 'Failed to delete message.');
        res.redirect('/userDashboard');
    }
});

// Edit User Details On Dashboard
router.get("/edit-user-details", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async(req, res) => {
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

// Update Password On Dashboard
router.post("/update-user-details", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const { name, username, email } = req.body;
        const userIdToUpdate = req.session.user._id ? req.session.user._id : null;

        if (!userIdToUpdate) {
            return res.status(400).json({ error: "User ID is missing from session" });
        }

        const existingUser = await userModel.findOne({ $or: [{ username: username }, { email: email }] });
        if (existingUser && existingUser._id.toString() !== userIdToUpdate) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        await userModel.findByIdAndUpdate(userIdToUpdate, { name, username, email });
        res.redirect("/userDashboard");
    } catch (error) {
        if (error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(400).json({ error: "Username or email already exists" });
        }
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/userchangepassword",checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    res.render("userChangePassword", { user, admin, employer });
});

router.post("/userchangepassword", async (req, res) => {
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

//-----------------------------------------------------------------------------

// User Signup
router.get("/signup", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const admin = req.session.admin;

    const employer = req.session.employer;

    res.render("signup", { success: successMessage, error: errorMessage, user, admin, employer });
});


router.post("/signup_post", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
router.get("/login", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");
    res.render("user/login", { error: errorMessage, user, admin, employer });
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
router.get("/logout", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
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

router.get("/forgot-password", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");
    const savedEmail = req.cookies['user_forgot_email'] || "";
    res.render("forgotPassword", { error: errorMessage, user, admin, savedEmail, employer });
});

router.post("/send-code", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
router.get("/enter-code", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const savedEmail = req.cookies['user_forgot_email'] || "";
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const errorMessage = req.flash("error");
    res.render("enterCode", { error: errorMessage, email: savedEmail, user, admin, employer });
});

router.post("/verify-code", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
function checkOTPVerification(req, res, next) {
    // Check if OTP verification has been completed
    if (req.session.isOTPVerified) {
        next();
    } else {
        req.flash("error", "Please verify your OTP first.");
        res.redirect("/enter-code");
    }
}


router.get("/reset-password", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkOTPVerification, (req, res) => {
    const savedEmail = req.cookies['user_forgot_email'] || "";
    const user = req.session.user;
    const admin = req.session.admin;

    const employer = req.session.employer;
    const errorMessage = req.flash("error");
    res.render("resetPassword", { error: errorMessage, email: savedEmail, user, admin, employer });
});

router.post("/update-password", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
            await userModel.findOneAndUpdate({ email }, { $set: { password: hashedPassword, sixDigitCode: null, sixDigitCodeExpires: null } });
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

// Add User Education

router.get('/add-education-form', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, (req, res) => {
    const { success, error } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("addEducation", { user, employer, admin, success, error });
});

router.post('/add-education', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { educationTitle, major, institutionName, startDate, endDate } = req.body;

    if (!educationTitle || !major || !institutionName || !startDate) {
        return res.render('addEducation', {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: 'Please fill in all required fields.'
        });
    }

    if (endDate && new Date(startDate) > new Date(endDate)) {
        return res.render("addEducation", {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: "End date should be equal to or after the start date.",
        });
    }

    try {
        const currentUser = await userModel.findById(req.session.user._id);

        currentUser.education.push({
            educationTitle,
            major,
            institutionName,
            startDate,
            endDate,
        });

        await currentUser.save();

        const updatedUser = await userModel.findById(req.session.user._id);

        req.session.user = updatedUser;

        const lastEducationId = updatedUser.education[updatedUser.education.length - 1]._id;
        req.session.editEducationId = lastEducationId;

        return res.render('addEducation', {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: 'Education added successfully!',
            error: null
        });
    } catch (error) {
        console.error(error);
        return res.render('addEducation', {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: 'Internal Server Error'
        });
    }
});


//---------------------------------------------------------------//

// Add experience

router.get('/experience-form', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, (req, res) => {
    const { success, error } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("addExperience", { user, employer, admin, success, error });
});

router.post("/add-experience", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { jobTitle, company, expStartDate, expEndDate, description } = req.body;

    const startDate = new Date(expStartDate);
    const endDate = expEndDate ? new Date(expEndDate) : null;

    if (!jobTitle || !company || !expStartDate || !description) {
        return res.render("addExperience", {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: "All fields are required.",
        });
    }

    if (endDate && startDate > endDate) {
        return res.render("addExperience", {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: "End date should be equal to or after the start date.",
        });
    }

    try {
        const currentUser = await userModel.findById(req.session.user._id);
        currentUser.experience.push({
            jobTitle,
            company,
            expStartDate: startDate,
            expEndDate: endDate,
            description,
        });
        await currentUser.save();

        const updatedUser = await userModel.findById(req.session.user._id);

        req.session.user = updatedUser;

        const lastExperienceId = updatedUser.experience[updatedUser.experience.length - 1]._id;
        req.session.editExperienceId = lastExperienceId;

        return res.render("addExperience", {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: "Experience added successfully!",
            error: null,
        });
    } catch (error) {
        console.error(error);
        return res.render("addExperience", {
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin,
            success: null,
            error: "Internal Server Error",
        });
    }
});


//------------------------------------------------------//

//Edit Education

router.get('/editEducation', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async(req, res) => {
    try {
        const educationId = req.query.educationId;
        req.session.editEducationId = educationId;

        if (!educationId) {
            return res.redirect("/userDashboard");
        }

        const user = req.session.user;
        const education = user.education.find(edu => edu._id.toString() === educationId);

        if (!education) {
            req.flash("error", "Education not found.");
            return res.redirect("/userDashboard");
        }

        res.render("editEducation", { user, educationId, education, success: req.flash("success"), error: req.flash("error") });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/userDashboard");
    }
});

//Update education
const updateEducationById = async (userId, educationId, updatedFields) => {
    try {
        const user = await userModel.findById(userId);
        const educationToUpdate = user.education.id(educationId);

        if (!educationToUpdate) {
            throw new Error("Education not found");
        }

        educationToUpdate.set(updatedFields);

        await user.save();

        return user;
    } catch (error) {
        throw error;
    }
};


router.post('/edit-education', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const educationId = req.session.editEducationId;
        const { educationTitle, major, institutionName, startDate, endDate } = req.body;

        if (!educationTitle || !major || !institutionName || !startDate) {
            req.flash('error', 'Please fill in all required fields.');
            return res.redirect(`/editEducation?educationId=${educationId}`);
        }

        if (endDate && startDate > endDate) {
            req.flash('error', 'End date should be equal to or after the start date.');
            return res.redirect(`/editEducation?educationId=${educationId}`);
        }

        const updatedUser = await updateEducationById(userId, educationId, {
            educationTitle,
            major,
            institutionName,
            startDate,
            endDate,
        });

        req.session.user = updatedUser;

        req.flash('success', 'Education updated successfully!');
        res.redirect(`/editEducation?educationId=${educationId}`);
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect(`/editEducation?educationId=${educationId}`);
    }
});


//Delete Education
router.get('/deleteEducation', checkEducationSession, async (req, res) => {
    try {
        const educationId = req.session.editEducationId;
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        if (!educationId) {
            req.flash('error', 'Education not found.');
            return res.redirect('/userDashboard');
        }

        res.render('deleteEducation', {
            educationId,
            user,
            admin,
            employer,
            success: req.flash('success'),
            error: req.flash('error'),
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/userDashboard');
    }
});


const getUserById = async (userId) => {
    return await userModel.findById(userId);
};

const deleteEducationById = async (userId, educationId) => {
    try {
        const user = await getUserById(userId);

        user.education = user.education.filter(edu => edu._id.toString() !== educationId);

        await user.save();

        return user;
    } catch (error) {
        throw error;
    }
};


router.post('/delete-education', checkAdminNotLoggedIn, checkEducationSession, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const educationId = req.session.editEducationId;

        await deleteEducationById(userId, educationId);

        delete req.session.editEducationId;

        req.flash('success', 'Education deleted successfully!');
        res.redirect('/userDashboard');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error deleting the education.');
        res.redirect('/userDashboard');
    }
});


router.get('/setDeleteEduId/:educationId', (req, res) => {
    const { educationId } = req.params;
    req.session.editEducationId = educationId;
    res.redirect('/deleteEducation');
});



// Store education in session to store

router.post('/setEditEducationId', (req, res) => {
    const { educationId } = req.body;
    req.session.editEducationId = educationId;

    res.redirect(`/editEducation?educationId=${educationId}`);
});

// Destroy Education session
router.get('/clearEduSession', (req, res) => {
    req.session.editEducationId = null;

    res.redirect('/userDashboard');
});


//Edit Experienece

router.get('/editExperience', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const experienceId = req.query.experienceId;
        req.session.editExperienceId = experienceId;

        if (!experienceId) {
            return res.redirect("/userDashboard");
        }

        const user = req.session.user;
        const experience = user.experience.find(exp => exp._id.toString() === experienceId);

        if (!experience) {
            req.flash("error", "Experience not found.");
            return res.redirect("/userDashboard");
        }

        res.render("editExperience", { user, experienceId, experience, success: req.flash("success"), error: req.flash("error") });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/userDashboard");
    }
});

//Update experience
const updateExperienceById = async (userId, experienceId, updatedFields) => {
    try {
        const user = await userModel.findById(userId);
        const experienceToUpdate = user.experience.id(experienceId);

        if (!experienceToUpdate) {
            throw new Error("Experience not found");
        }

        experienceToUpdate.set(updatedFields);

        await user.save();

        return user;
    } catch (error) {
        throw error;
    }
};

router.post('/edit-experience', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const experienceId = req.session.editExperienceId;
        const { jobTitle, company, expStartDate, expEndDate, description } = req.body;

        if (!jobTitle || !company || !expStartDate || !description) {
            req.flash('error', 'Please fill in all required fields.');
            return res.redirect('/editExperience');
        }

        if (expEndDate && expStartDate > expEndDate) {
            req.flash('error', 'End date should be equal to or after the start date.');
            return res.redirect('/editExperience?experienceId=${experienceId}');
        }

        const updatedUser = await updateExperienceById(userId, experienceId, {
            jobTitle,
            company,
            expStartDate,
            expEndDate,
            description,
        });

        req.session.user = updatedUser;

        req.flash('success', 'Experience updated successfully!');
        res.redirect('/editExperience?experienceId=${experienceId}');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/editExperience?experienceId=${experienceId}');
    }
});

// Delete Experience
router.get('/deleteExperience', checkExperienceSession, async (req, res) => {
    try {
        const experienceId = req.session.editExperienceId;
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        if (!experienceId) {
            req.flash('error', 'Experience not found.');
            return res.redirect('/userDashboard');
        }

        res.render('deleteExperience', {
            experienceId,
            user,
            admin,
            employer,
            success: req.flash('success'),
            error: req.flash('error'),
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/userDashboard');
    }
});

const deleteExperienceById = async (userId, experienceId) => {
    try {
        const user = await getUserById(userId);

        user.experience = user.experience.filter(exp => exp._id.toString() !== experienceId);

        await user.save();

        return user;
    } catch (error) {
        throw error;
    }
};

router.post('/delete-experience', checkAdminNotLoggedIn, checkExperienceSession, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const experienceId = req.session.editExperienceId;

        await deleteExperienceById(userId, experienceId);

        delete req.session.editExperienceId;

        req.flash('success', 'Experience deleted successfully!');
        res.redirect('/userDashboard');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error deleting the experience.');
        res.redirect('/userDashboard');
    }
});

router.get('/setDeleteExpId/:experienceId', (req, res) => {
    const { experienceId } = req.params;
    req.session.editExperienceId = experienceId;
    res.redirect('/deleteExperience');
});


// Store experience in session to store

router.post('/setEditExperienceId', (req, res) => {
    const { experienceId } = req.body;
    req.session.editExperienceId = experienceId;

    res.redirect('/editExperience');
});

// Destroy Experience session
router.get('/clearExpSession', (req, res) => {
    req.session.editExperienceId = null;

    res.redirect('/userDashboard');
});

//Contact Page 
router.post('/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const newContactMessage = new ContactMessageModel({
            name,
            email,
            message,
        });

        await newContactMessage.save();
        res.json({ status: 'success', message: 'Your message has been sent successfully!' });
    } catch (error) {
        console.log(error);
        res.json({ status: 'error', message: 'An error occurred while sending your message. Please try again.' });
    }
});

//Search employer 
router.get('/employerPage', checkAdminNotLoggedIn, checkEmployerNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const employers = await employerModel.find({}, 'employerName registrationNumber logo');

        employers.forEach(employer => {
            employer.registrationNumber = employer.registrationNumber.toUpperCase();
        });

        const user = req.session.user;

        res.render('employerPage', { employers, user });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/employerPage');
    }
});

router.post('/viewProfile', (req, res) => {
    const { employerId } = req.body;
    req.session.employerId = employerId;
    res.redirect('/employerProfile');
});



router.get('/employerProfile', checkAdminNotLoggedIn, checkEmployerNotLoggedIn, async (req, res) => {
    try {
        const employerId = req.session.employerId;
        if (!employerId) {
            req.flash('error', 'Employer ID not found in session.');
            return res.redirect('/employerPage');
        }

        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const emp = await employerModel.findById(employerId);

        const jobs = await jobModel.find({ employerId: employerId });

        res.render('employerProfile', { employer, jobs, user, emp, admin });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error fetching employer profile.');
        res.redirect('/employerPage');
    }
});


// Message send to employer
router.get('/empMessage', checkAdminNotLoggedIn, checkEmployerNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const employerId = req.session.employerId;
        const { success, error } = req.query;

        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const emp = await employerModel.findById(employerId);

        res.render('empMessage', { employer, user, admin, emp, success, error });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/employerProfile');
    }
});

// Message Post route
router.post('/sendMessage', async (req, res) => {
    try {
        const { message } = req.body;
        const senderId = req.session.user;
        const recipientId = req.session.employerId;

        const newMessage = new messageModel({
            senderId: senderId,
            senderModel: 'userModel',
            recipientId: recipientId,
            recipientModel: 'employerModel',
            message: message
        });

        await newMessage.save();

        res.redirect('/empMessage?success=Message sent successfully');
    } catch (error) {
        console.error(error);
        res.redirect('/empMessage?error=Error sending message');
    }
});

//View Message
router.get('/viewMessage', checkAdminNotLoggedIn, checkEmployerNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user;

        const user = req.session.user;
        const admin = req.session.admin;
        const employer = req.session.employer;

        const messages = await messageModel.find({
            recipientId: userId,
            senderModel: 'employerModel',
        }).populate({
            path: 'senderId',
            model: 'employerModel',
            select: 'employerName'
        });

        res.render('viewMessage', { messages, user, admin, employer });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/userDashboard');
    }
});

//Reply Message

router.post('/rplyMessage', async (req, res) => {
    try {
        const { messageId, reply } = req.body;

        const message = await messageModel.findById(messageId);

        message.reply = reply;
        await message.save();

        res.redirect('/viewMessage');
    } catch (error) {
        console.error(error);
        res.redirect('/viewMessage');
    }
});


//Sent Messages
router.get('/sentMessage', checkAdminNotLoggedIn, checkEmployerNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const userId = req.session.user;

        const user = req.session.user;
        const admin = req.session.admin;
        const employer = req.session.employer;

        const messages = await messageModel.find({
            senderId: userId,
            senderModel: 'userModel'
        }).populate({
            path: 'recipientId',
            model: 'employerModel',
            select: 'employerName'
        });

        res.render('sentMessage', { messages, user, admin, employer });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/userDashboard');
    }
});

router.post('/deleteMessage/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        await messageModel.findByIdAndDelete(messageId);

        res.redirect('/viewMessage');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/deleteSentMessage/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        await messageModel.findByIdAndDelete(messageId);

        res.redirect('/sentMessage');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



  router.get("/userAllMessages",checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10;
        const userId = req.session.user._id;

        const user = await userModel.findById(userId);
        if (!user || !user.messages) {
            req.flash("info", "No messages available.");
            return res.redirect("/userDashboard");
        }
        let adminDetails = await adminModel.findOne();
        const skip = (page - 1) * pageSize;

        const totalMessages = user.messages.length;
        const totalPages = Math.ceil(totalMessages / pageSize);

        const messages = user.messages
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(skip, skip + pageSize)
            .map(message => ({
                ...message.toObject(),
                adminUniqueId: adminDetails ? adminDetails.adminId : 'Admin not found',
                createdAtFormatted: message.createdAt.toDateString(),
            }));

        res.render("userAllMessages", {
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
        res.redirect("/userDashboard");
    }
});

router.get("/moreExperience",checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.session.user._id);
        if (!user || !user.experience) {
            req.flash("info", "No experience records available.");
            return res.redirect("/userDashboard");
        }
        res.render("moreExperience", {
            experiences: user.experience,
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error("Error fetching experiences:", error);
        req.flash("error", "Internal Server Error");
        res.redirect("/userDashboard");
    }
});

router.get("/moreEducation",checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.session.user._id);
        if (!user || !user.education) {
            req.flash("info", "No education records available.");
            return res.redirect("/userDashboard");
        }
        res.render("moreEducation", {
            educations: user.education,
            user: req.session.user,
            employer: req.session.employer,
            admin: req.session.admin
        });
    } catch (error) {
        console.error("Error fetching educations:", error);
        req.flash("error", "Internal Server Error");
        res.redirect("/userDashboard");
    }
});


// router.get("/appliedJobs", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
//     try {
//         const appliedJobs = [];
//         if (appliedJobs.length === 0) {
//             req.flash("info", "No applied jobs available.");
//         }
//         res.render("appliedJobs", {
//             appliedJobs,
//             user: req.session.user,
//             employer: req.session.employer,
//             admin: req.session.admin
//         });
//     } catch (error) {
//         console.error("Error fetching applied jobs:", error);
//         req.flash("error", "Internal Server Error");
//         res.redirect("/userDashboard");
//     }
// });

router.get("/likedJobs", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const user = await userModel.findById(req.session.user._id);

        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/login");
        }

        const likedJobsIds = user.likedJobs.slice(skip, skip + limit);

        const likedJobs = await Promise.all(
            likedJobsIds.map(async (jobId) => {
                return await jobModel.findById(jobId).populate('employerId', 'employerName').exec();
            })
        );

        const totalLikedJobs = user.likedJobs.length;
        const totalPages = Math.ceil(totalLikedJobs / limit);

        res.render("likedJobs", {
            likedJobs: likedJobs.filter(job => job !== null),
            currentPage: page,
            totalPages: totalPages,
            user: req.session.user
        });
    } catch (error) {
        console.error("Error fetching liked jobs:", error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/userDashboard");
    }
});


router.get("/appliedJobs", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkLoggedIn, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const user = await userModel.findById(req.session.user._id);

        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/login");
        }

        const appliedJobsIds = user.appliedJobs.slice(skip, skip + limit);

        const appliedJobs = await Promise.all(
            appliedJobsIds.map(async (jobId) => {
                return await jobModel.findById(jobId).populate('employerId', 'employerName').exec();
            })
        );

        const totalappliedJobs = user.appliedJobs.length;
        const totalPages = Math.ceil(totalappliedJobs / limit);

        res.render("appliedJobs", {
            appliedJobs: appliedJobs.filter(job => job !== null),
            currentPage: page,
            totalPages: totalPages,
            user: req.session.user
        });
    } catch (error) {
        console.error("Error fetching applied jobs:", error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/userDashboard");
    }
});


// router.get('/applyJob/:jobId', async (req, res) => {
//     if (!req.session.user) {
//         return res.redirect('/login');
//     }
//     try {
//         const { jobId } = req.params;
//         const job = await jobModel.findById(jobId).populate('employerId').exec();
//         if (!job) {
//             return res.status(404).send('Job not found');
//         }
//         res.render('job/applyJob', { job, user: req.session.user });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Internal Server Error');
//     }
// });

router.post('/unlikeJob/:jobId', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const userId = req.session.user._id;
        const { jobId } = req.params;
        const user = await userModel.findById(userId);
        const index = user.likedJobs.indexOf(jobId);
        if (index > -1) {
            user.likedJobs.splice(index, 1);
            await user.save();
            req.session.user.likedJobs = user.likedJobs;
            res.redirect('/searchJob');
        } else {
            console.log(`Job ${jobId} was not found in the liked jobs of user ${userId}.`);
            res.redirect('/searchJob');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

//Upload resume
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

router.post('/uploadResume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.session.user._id;

        const filePath = req.file.path;

        const user = await userModel.findById(userId);
        if (!user) {
            fs.unlinkSync(filePath);
            return res.status(404).json({ error: 'User not found' });
        }

        user.resume = filePath;

        await user.save();

        res.redirect('/userDashboard');
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.redirect('/userDashboard');
    }
});

router.post('/deleteResume', async (req, res) => {
    try {
        const userId = req.session.user._id;

        await userModel.findByIdAndUpdate(userId, { resume: null });

        res.redirect('/userDashboard');
    } catch (error) {
        console.error(error);
        res.redirect('/userDashboard');
    }
});


//----------------------------------------------------------------------//


//Update profile logo
const store = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const images = multer({ storage: store });


router.post('/uploadLogo', images.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.session.user._id;

        const filePath = req.file.filename;

        const user = await userModel.findById(userId);
        if (!user) {
            fs.unlinkSync(filePath);
            return res.status(404).json({ error: 'User not found' });
        }

        user.logo = filePath;

        await user.save();

        res.redirect('/userDashboard');
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.redirect('/userDashboard');
    }
});


// Delete logo
router.post('/deleteLogo', async (req, res) => {
    try {
        const userId = req.session.user._id;
        await userModel.findByIdAndUpdate(userId, { $unset: { logo: "" } });
        res.redirect('/userDashboard');
    } catch (error) {
        console.error("Error deleting logo:", error);
        res.redirect("/userDashboard");
    }
});





module.exports = router;