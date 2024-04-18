const express = require("express");
const router = express.Router();
const jobModel = require("../models/jobModel");
const employerModel = require("../models/employerModel");
const multer = require('multer');
const Application = require('../models/applicationModel');
const userModel = require("../models/userModel");
const path = require('path');

// Update job function
async function updateJobById(jobId, updatedFields) {
    try {
        const updatedJob = await jobModel.findByIdAndUpdate(jobId, updatedFields, { new: true });
        return updatedJob;
    } catch (error) {
        throw error;
    }
}

// Admin Routes Restricted
const checkAdminNotLoggedIn = (req, res, next) => {
    if (!req.session.admin) {
        next();
    } else {
        res.redirect('/home');
    }
};

// If Job not in session route Restricted
const checkJobSession = (req, res, next) => {
    if (req.session.editJobId) {
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

/*Job Search */
router.get('/searchJob', async (req, res) => {
    try {
        const { job, location, salary, sector, company } = req.query;
        let filter = { status: 'approved' };
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        if (job) filter.jobTitle = new RegExp(job, 'i');
        if (location) {
            filter.$or = [
                { street: new RegExp(location, 'i') },
                { city: new RegExp(location, 'i') },
                { province: new RegExp(location, 'i') },
                { postalCode: new RegExp(location, 'i') }
            ];
        }
        if (salary) {
            const [minSalary, maxSalary] = salary.split('-').map(Number);
            filter.salary = { $gte: minSalary, $lte: maxSalary };
        }
        if (sector) filter.sector = sector;
        if (company) {
            const employersMatchingCompany = await employerModel.find({ employerName: new RegExp(company, 'i') });
            const employerIds = employersMatchingCompany.map(employer => employer._id);
            filter.employerId = { $in: employerIds };
        }

        const totalJobs = await jobModel.countDocuments(filter);
        const uniqueSectors = await jobModel.distinct('sector');
        const uniqueCompanies = await employerModel.distinct('employerName');
        const jobs = await jobModel.find(filter).skip(skip).limit(limit).populate('employerId', 'employerName sector').exec();

        let userAppliedJobs = [];
        if (user) {
            const userData = await userModel.findById(user._id);
            userAppliedJobs = userData.appliedJobs;
        }

        for (let job of jobs) {
            const jobIdAsString = job._id.toString();
            job.isLikedByCurrentUser = user && user.likedJobs && user.likedJobs.includes(jobIdAsString);
        }

        const totalPages = Math.ceil(totalJobs / limit);

        res.render("searchJob", {
            user,
            employer,
            admin,
            jobs,
            uniqueSectors,
            uniqueCompanies,
            jobFilters: { job, location, salary, sector, company },
            selectedSector: sector,
            userAppliedJobs,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching jobs with sector filter:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/searchJob', async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    try {
        const { job, location, salary, sector, company } = req.body;

        let queryParams = {};

        let filter = { status: 'approved' };

        if (job) {
            filter.jobTitle = new RegExp(job, 'i');
            queryParams.job = job;
        }
        if (location) {
            filter.$or = [
                { street: new RegExp(location, 'i') },
                { city: new RegExp(location, 'i') },
                { province: new RegExp(location, 'i') },
                { postalCode: new RegExp(location, 'i') }
            ];
            queryParams.location = location;
        }
        if (salary) {
            const [minSalaryStr, maxSalaryStr] = salary.split('-');
            const extractNumericValue = (salaryString) => parseFloat(salaryString.replace(/[^\d.]/g, ''));
            const minSalary = extractNumericValue(minSalaryStr);
            const maxSalary = extractNumericValue(maxSalaryStr);
            filter.salary = { $gte: minSalary, $lte: maxSalary };
            queryParams.salary = salary;
        }
        if (sector) {
            filter.sector = new RegExp(sector, 'i');
            queryParams.sector = sector;
        }
        if (company) {
            const employersMatchingCompany = await employerModel.find({ employerName: new RegExp(company, 'i') });
            const employerIds = employersMatchingCompany.map(employer => employer._id);
            filter.employerId = { $in: employerIds };
            queryParams.company = company;
        }

        const jobs = await jobModel.find(filter).populate('employerId', 'employerName').exec();

        for (let job of jobs) {
            const jobIdAsString = job._id.toString();
            job.isLikedByCurrentUser = user && user.likedJobs && user.likedJobs.includes(jobIdAsString);
        }

        if (Object.keys(queryParams).length === 0) {
            res.redirect('/searchJob');
        } else {
            res.redirect('/searchJob?' + new URLSearchParams(queryParams).toString());
        }
    } catch (error) {
        console.error('Error in posting job search:', error);
        res.redirect('/searchJob');
    }
});


/*Job Listing*/
router.get('/listJob', checkUserNotLoggedIn, checkAdminNotLoggedIn, (req, res) => {
    const { success, error } = req.query;
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("listJob", { user, employer, admin, success, error });
});

router.post("/add-job", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    const { jobTitle, sector, salary, street, city, province, postalCode, description } = req.body;

    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    const provinceRegex = /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/;

    if (!postalCodeRegex.test(postalCode)) {
        return res.render("listJob", { user, employer, admin, success: null, error: "Please enter a valid postal code. Eg: 'A1A 2B3'" });
    }

    if (!provinceRegex.test(province)) {
        return res.render("listJob", { user, employer, admin, success: null, error: "Please enter a valid province. Eg: 'ON, SK'" });
    }

    if (isNaN(salary) || salary.trim() === '') {
        return res.render("listJob", { user, employer, admin, success: null, error: "Please enter a valid numeric salary." });
    }

    try {
        const salaryWithDollar = `$${salary}`;
        const employerId = req.session.employer._id;

        const newJob = new jobModel({
            jobTitle,
            sector,
            salary: salaryWithDollar,
            street,
            city,
            province,
            postalCode,
            description,
            employerId,
        });

        await newJob.save();

        return res.render("listJob", { user, employer, admin, success: "Job added successfully!", error: null });
    } catch (error) {
        console.error(error);
        return res.render("listJob", { user, employer, admin, success: null, error: "Internal Server Error" });
    }
});


//---------------------------------------------------------------//

//Edit Job

router.get('/editJob', checkUserNotLoggedIn, checkAdminNotLoggedIn, checkJobSession, async (req, res) => {
    try {
        const jobId = req.session.editJobId;
        const job = await jobModel.findById(jobId);
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        if (!job) {
            req.flash("error", "Job not found.");
            return res.redirect("/editJob");
        }

        res.render("editJob", { jobId, user, admin, employer, job, success: req.flash("success"), error: req.flash("error") });
    } catch (error) {
        console.error(error);
        res.redirect("/editJob");
    }
});

router.post('/edit-job', checkUserNotLoggedIn, checkAdminNotLoggedIn, checkJobSession, async (req, res) => {
    const jobId = req.session.editJobId;
    const { jobTitle, sector, salary, street, city, province, postalCode, description } = req.body;

    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    const provinceRegex = /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/;

    if (!postalCodeRegex.test(postalCode)) {
        req.flash("error", "Please enter a valid postal code. Eg: 'A1A 2B3'");
        return res.redirect("/editJob");
    }

    if (!provinceRegex.test(province)) {
        req.flash("error", "Please enter a valid province. Eg: 'ON, SK'");
        return res.redirect("/editJob");
    }

    if (isNaN(salary) || salary.trim() === '') {
        req.flash("error", "Please enter a valid numeric salary.");
        return res.redirect("/editJob");
    }

    try {
        const salaryWithDollar = `$${salary}`;

        await updateJobById(jobId, {
            jobTitle,
            sector,
            salary: salaryWithDollar,
            street,
            city,
            province,
            postalCode,
            description,
        });

        req.flash('success', 'Job updated successfully!');
        res.redirect("/editJob");
    } catch (error) {
        console.error(error);
        res.redirect("/editJob");
    }
});

//Delete Job
router.get('/deleteJob', async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    let jobId = req.query.jobId;

    // If jobId is not in the query, try getting it from the session
    if (!jobId && req.session.jobId) {
        jobId = req.session.jobId;
    }


    res.render('deleteJob', { user, employer, admin, jobId, success: null, error: null });
});

router.post('/deleteJob', async (req, res) => {
    try {
        const { jobId } = req.body;

        if (!jobId) {
            console.error('Job ID not provided');
            return res.render('deleteJob', {
                error: 'No job ID provided. Please try again.',
                success: null,
                jobId: null, // No jobId to operate on
            });
        }

        await jobModel.findByIdAndDelete(jobId);
        console.log('Job deleted successfully.');

        res.render('deleteJob', {
            success: 'Job deleted successfully.',
            error: null,
            jobId: null,
        });
    } catch (error) {
        console.error('Error deleting job:', error);

        res.render('deleteJob', {
            error: 'Error deleting the job. Please try again.',
            success: null,
            jobId: req.body.jobId,
        });
    }
});


router.get('/setDeleteJobId/:jobId', (req, res) => {
    const { jobId } = req.params;
    req.session.jobId = jobId;
    res.redirect('/deleteJob');
});


//--------------------------------------------------------------------//

// Job Id session to retrieve job details on edit job page
router.post('/setEditJobId', (req, res) => {
    const jobId = req.body.jobId;
    req.session.editJobId = jobId;
    res.redirect('/editJob');
});

//--------------------------------------------------------------------//

// Destroy job session
router.get('/clearJobSession', (req, res) => {
    req.session.editJobId = null;

    res.redirect('/empDashboard');
});

//--------------------------------------------------------------------//

router.get('/applyJob/:jobId', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const { jobId } = req.params;
        const job = await jobModel.findById(jobId).populate('employerId').exec();

        if (!job) {
            return res.status(404).send('Job not found');
        }

        const { user, employer, admin } = req.session;

        const successMessage = req.flash('success')[0];
        const errorMessage = req.flash('error')[0];
        res.render('job/applyJob', { job, user, employer, admin, successMessage, errorMessage });
    } catch (err) {
        console.error(err);
    }
});


//--------------//


/* file upload */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });


router.post('/submitApplication', upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'coverLetter', maxCount: 1 }]), async (req, res) => {
    let jobId;

    try {
        const { jobId } = req.body;
        const resumeFile = req.files['resume'][0];
        const coverLetterFile = req.files['coverLetter'][0];

        const userId = req.session.user._id;

        const appliedJobs = await userModel.findById(userId);
        if (appliedJobs.appliedJobs.includes(jobId)) {
            req.flash('error', 'You have already applied for this job');
            return res.redirect(`/applyJob/${jobId}`);
        }

        const application = new Application({
            jobId: jobId,
            userId: userId,
            resume: resumeFile.filename,
            coverLetter: coverLetterFile.filename,
        });
        await application.save();

        appliedJobs.appliedJobs.push(jobId);
        await appliedJobs.save();

        req.flash('success', 'Application submitted successfully');
        return res.redirect(`/applyJob/${jobId}`);
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error submitting application');
        return res.redirect(`/applyJob/${jobId}`);
    }
});



router.post('/likeJob/:jobId', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userId = req.session.user._id;
        const { jobId } = req.params;

        const user = await userModel.findById(userId);

        if (!user.likedJobs.includes(jobId)) {
            user.likedJobs.push(jobId);
            await user.save();

            req.session.user.likedJobs = user.likedJobs;

            console.log(`User ${userId} liked job ${jobId} successfully`);
        } else {
            console.log(`User ${userId} has already liked job ${jobId}.`);
        }

        res.redirect('/searchJob');

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

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

            console.log(`User ${userId} unliked job ${jobId} successfully`);
        } else {
            console.log(`Job ${jobId} was not found in the liked jobs of user ${userId}.`);
        }

        res.redirect('/searchJob');

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});





module.exports = router;