const express = require("express");
const router = express.Router();
const jobModel = require("../models/jobModel");
const employerModel = require("../models/employerModel");


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

/*Job Search*/
router.get('/searchJob', async (req, res) => {
    try {
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const uniqueSectors = await jobModel.distinct('sector');

        const uniqueCompanies = await employerModel.distinct('employerName');

        const jobs = await jobModel.find().populate('employerId', 'employerName sector').exec();

        res.render("searchJob", { user, employer, admin, jobs, uniqueSectors, uniqueCompanies });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/searchJob");
    }
});




router.post('/searchJob', async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    try {
        const { job, location, salary, sector, company } = req.body;

        const filter = {};

        if (job) {
            filter.jobTitle = new RegExp(job, 'i');
        }

        if (location) {
            filter.$or = [
                { street: new RegExp(location, 'i') },
                { city: new RegExp(location, 'i') },
                { province: new RegExp(location, 'i') },
                { postalCode: new RegExp(location, 'i') },
            ];
        }

        if (salary) {
            const [minSalaryStr, maxSalaryStr] = salary.split('-');

            const extractNumericValue = (salaryString) => {
                return parseFloat(salaryString.replace(/[^\d.]/g, ''));
            };

            const minSalary = extractNumericValue(minSalaryStr);
            const maxSalary = extractNumericValue(maxSalaryStr);

            filter.salary = {
                $gte: minSalary,
                $lte: maxSalary,
            };
        }


        if (sector) {
            filter.sector = new RegExp(sector, 'i');
        }

        if (company) {
            const employersMatchingCompany = await employerModel.find({
                employerName: new RegExp(company, 'i'),
            });

            const employerIds = employersMatchingCompany.map((employer) => employer._id);

            filter.employerId = { $in: employerIds };
        }

        const uniqueSectors = await jobModel.distinct('sector');
        const uniqueCompanies = await employerModel.distinct('employerName');

        const jobs = await jobModel.find(filter).populate('employerId', 'employerName').exec();

        res.render('searchJob', { user, employer, admin, jobs, uniqueSectors, uniqueCompanies });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Internal Server Error');
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
        return res.render("listJob", { error: "Please enter a valid postal code. Eg: 'A1A 2B3'", user, employer, admin });
    }

    if (!provinceRegex.test(province)) {
        return res.render("listJob", { error: "Please enter a valid province. Eg: 'ON, SK'", user, employer, admin });
    }

    if (isNaN(salary) || salary.trim() === '') {
        return res.render("listJob", { error: "Please enter a valid numeric salary.", user, employer, admin });
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
        req.flash("error", "Internal Server Error");
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
        req.flash('error', 'Internal Server Error');
        res.redirect("/editJob");
    }
});


//Delete Job
router.get('/deleteJob', async (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;

    const jobId = req.session.jobId;

    res.render('deleteJob', { user, employer, admin, jobId });
});


router.post('/deleteJob', async (req, res) => {
    try {
        const jobId = req.session.deleteJobId;

        if (!jobId) {
            req.flash('error', 'Job ID not found in the session.');
            return res.redirect('/empDashboard');
        }

        await jobModel.findByIdAndDelete(jobId);

        delete req.session.deleteJobId;

        req.flash('success', 'Job deleted successfully.');
        res.redirect('/empDashboard');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error deleting the job.');
        res.redirect('/empDashboard');
    }
});

router.get('/setDeleteJobId/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    req.session.deleteJobId = jobId;
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


module.exports = router;