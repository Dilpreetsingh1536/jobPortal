const express = require("express");
const router = express.Router();
const jobModel = require("../models/jobModel");
const employerModel = require("../models/employerModel");
const userModel = require( "../models/userModel" );

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
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;

        const uniqueSectors = await jobModel.distinct('sector');
        
        const uniqueCompanies = await employerModel.distinct('employerName');

        const jobs = await jobModel.find({ status: 'approved' }).populate('employerId', 'employerName sector').exec();

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

        const filter = { status: 'approved' };

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

    // Validation regex
    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    const provinceRegex = /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$/;

    // Validate postal code
    if (!postalCodeRegex.test(postalCode)) {
        return res.render("listJob", { user, employer, admin, success: null, error: "Please enter a valid postal code. Eg: 'A1A 2B3'" });
    }

    // Validate province
    if (!provinceRegex.test(province)) {
        return res.render("listJob", { user, employer, admin, success: null, error: "Please enter a valid province. Eg: 'ON, SK'" });
    }

    // Validate salary
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
        // Render with error message
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

    let jobId = req.query.jobId;

    // If jobId is not in the query, try getting it from the session
    if (!jobId && req.session.jobId) {
        jobId = req.session.jobId;
    }


    res.render('deleteJob', { user, employer, admin, jobId, success: null, error: null  });
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
        const { jobId } = req.params;
        const job = await jobModel.findById(jobId).exec();

        if (!job) {
            return res.status(404).send('Job not found');
        }

        const { user, employer, admin } = req.session;
        res.render('job/applyJob', { job, user, employer, admin });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/likeJob/:jobId', async (req, res) => {
    if (!req.session.user) {
      return res.status(401).send('User not logged in');
    }
  
    try {
      const userId = req.session.user._id;
      const { jobId } = req.params;
  
      const user = await userModel.findById(userId);
  
      if (!user.likedJobs.includes(jobId)) {
        user.likedJobs.push(jobId);
        await user.save();
        console.log(`User ${userId} liked job ${jobId} successfully`);
      } else {
        console.log(`User ${userId} has already liked job ${jobId}.`);
      }
  
      res.redirect('back'); 
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
});
  

module.exports = router;

