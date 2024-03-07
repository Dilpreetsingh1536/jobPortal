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
router.get('/searchJob', checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    try {
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const jobs = await jobModel.find().populate('employerId', 'employerName sector').exec();

        const uniqueSectors = Array.from(new Set(jobs.map(job => job.sector)));
        const uniqueCompanies = Array.from(new Set(jobs.map(job => job.employerId.employerName)));

        res.render("searchJob", { user, employer, admin, jobs, uniqueSectors, uniqueCompanies });
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        res.redirect("/searchJob");
    }
});

router.post('/searchJob', checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
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
            const [minSalary, maxSalary] = salary.split('-');
            const minSalaryValue = parseInt(minSalary.replace(/\D/g, ''), 10);
            const maxSalaryValue = parseInt(maxSalary.replace(/\D/g, ''), 10);

            if (minSalaryValue <= 50000 && maxSalaryValue >= 0) {
                filter.salary = { $lte: 50000 };
            } else if (minSalaryValue <= 100000 && maxSalaryValue >= 51000) {
                filter.salary = { $gte: 51000, $lte: 100000 };
            } else if (minSalaryValue <= 150000 && maxSalaryValue >= 110000) {
                filter.salary = { $gte: 110000, $lte: 150000 };
            } else if (minSalaryValue > 150000) {
                filter.salary = { $gt: 150000 };
            }
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

    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("listJob", { user, employer, admin, success: successMessage, error: errorMessage });
})

router.post("/add-job", checkUserNotLoggedIn, checkAdminNotLoggedIn, async (req, res) => {
    const { jobTitle, sector, salary, street, city, province, postalCode, description } = req.body;

    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    const provinceRegex = /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/;

    if (!postalCodeRegex.test(postalCode)) {
        req.flash("error", "Please enter a valid postal code. Eg: 'A1A 2B3'");
        return res.redirect("/listJob");
    }

    if (!provinceRegex.test(province)) {
        req.flash("error", "Please enter a valid province. Eg: 'ON, SK'");
        return res.redirect("/listJob");
    }

    if (isNaN(salary) || salary.trim() === '') {
        req.flash("error", "Please enter a valid numeric salary.");
        return res.redirect("/listJob");
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

        req.flash("success", "Job added successfully!");
        return res.redirect("/listJob");
    } catch (error) {
        console.error(error);
        req.flash("error", "Internal Server Error");
        return res.redirect("/listJob");
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