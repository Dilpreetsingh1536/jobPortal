const express = require("express");
const router = express.Router();
const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const ContactMessageModel = require('../models/contactMessageModel');

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
router.get("/userDashboard", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const userData = await userModel.findById(req.session.user._id);
        const employer = req.session.employer;
        const admin = req.session.admin;

        const user = {
            name: userData.name,
            username: userData.username,
            email: userData.email,
            education: userData.education,
            experience: userData.experience,
        };

        res.render("userDashboard", { user, admin, employer });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/userDashboard");
    }
});


// Edit User Details On Dashboard
router.get("/edit-user-details", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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

router.get("/userchangepassword", (req, res) => {
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
router.get("/reset-password", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
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

// Add User Education

router.get('/add-education-form', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const { success, error } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("addEducation", { user, employer, admin, success, error });
});

router.post('/add-education', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    try {
        const { educationTitle, major, institutionName, startDate, endDate } = req.body;

        if (!educationTitle || !major || !institutionName || !startDate) {
            return res.render('addEducation', {
                user,
                employer,
                admin,
                success: null,
                error: 'Please fill in all required fields.'
            });
        }




        if (endDate && startDate > endDate) {
            return res.render("addEducation", {
                user,
                employer,
                admin,
                success: null,
                error: "End date should be equal to or after the start date.",
            });
        }


        const user = await userModel.findById(req.session.user._id);

        user.education.push({
            educationTitle,
            major,
            institutionName,
            startDate,
            endDate,
        });

        await user.save();

        return res.render('addEducation', {
            user,
            employer,
            admin,
            success: 'Education added successfully!',
            error: null
        });
    } catch (error) {
        console.error(error);

        return res.render('addEducation', {
            user,
            employer,
            admin,
            success: null,
            error: 'Internal Server Error'
        });
    }
});


//---------------------------------------------------------------//

// Add experience

router.get('/experience-form', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const { success, error } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("addExperience", { user, employer, admin, success, error });
});

router.post("/add-experience", checkEmployerNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const { jobTitle, company, expStartDate, expEndDate, description } = req.body;

    const startDate = new Date(expStartDate);
    const endDate = expEndDate ? new Date(expEndDate) : null;

    if (!jobTitle || !company || !expStartDate || !description) {
        return res.render("addExperience", {
            user,
            employer,
            admin,
            success: null,
            error: "All fields are required.",
        });
    }

    if (endDate && startDate > endDate) {
        return res.render("addExperience", {
            user,
            employer,
            admin,
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

        return res.render("addExperience", {
            user,
            employer,
            admin,
            success: "Experience added successfully!",
            error: null,
        });
    } catch (error) {
        console.error(error);

        return res.render("addExperience", {
            user,
            employer,
            admin,
            success: null,
            error: "Internal Server Error",
        });
    }
});

//------------------------------------------------------//

//Edit Education

router.get('/editEducation', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkEducationSession, async (req, res) => {
    try {
        const educationId = req.session.editEducationId;
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const education = user.education.find(edu => edu._id.toString() === educationId);

        if (!education) {
            req.flash("error", "Education not found.");
            return res.redirect("/editEducation");
        }

        res.render("editEducation", { educationId, user, admin, employer, education, success: req.flash("success"), error: req.flash("error") });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/editEducation");
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
            return res.redirect('/editEducation');
        }

        if (endDate && startDate > endDate) {
            req.flash('error', 'End date should be equal to or after the start date.');
            return res.redirect('/editEducation');
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
        res.redirect('/editEducation');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/editEducation');
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

    res.redirect('/editEducation');
});

// Destroy Education session
router.get('/clearEduSession', (req, res) => {
    req.session.editEducationId = null;

    res.redirect('/userDashboard');
});


//Edit Experienece

router.get('/editExperience', checkEmployerNotLoggedIn, checkAdminNotLoggedIn, checkExperienceSession, async (req, res) => {
    try {
        const experienceId = req.session.editExperienceId;
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const experience = user.experience.find(exp => exp._id.toString() === experienceId);

        if (!experience) {
            req.flash("error", "Experience not found.");
            return res.redirect("/userDashboard");
        }

        res.render("editExperience", { experienceId, user, admin, employer, experience, success: req.flash("success"), error: req.flash("error") });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/userDashboard");
    }
});

//Update experience
const updateExperienceById = async (userId, experienceId, updatedFields) => {
    try {
        const user = await userModel.findById(userId);
        const experienceToUpdate = user.experience.id(experienceId);

        if (!experienceToUpdate) {
            throw new Error("Education not found");
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
            return res.redirect('/editExperience');
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
        res.redirect('/editExperience');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/editExperience');
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
  

module.exports = router;
