const express = require("express");
const app = express();
const { exec } = require('child_process');
const bodyParser = require("body-parser");
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const empRoutes = require("./routes/empRoutes");
const adminRoutes = require("./routes/adminRoutes");
const jobRoutes = require("./routes/jobRoutes");
const jobModel = require('./models/jobModel');
const employerModel = require( './models/employerModel' );




const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(flash());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

const PORT = process.env.PORT || 3001; 

app.listen(PORT, () => {
    console.log(`Server is listening at port ${PORT}`);
    exec(`start http://localhost:${PORT}/home`, (error) => {
        if (error) {
            console.error(`Could not open the browser: ${error}`);
            return;
        }
        console.log('Browser opened successfully!');
    });
});

app.set("views", [
    path.join(__dirname, "views"),
    path.join(__dirname, "views", "user"),
    path.join(__dirname, "views", "employer"),
    path.join(__dirname, "views", "job"),
    path.join(__dirname, "views", "admin"),
    path.join(__dirname, "views", "partials"),
    path.join(__dirname, "views", "contact")
   

]);

/* SESSION */
const uri = "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/?retryWrites=true&w=majority";
const accountSessionStore = MongoStore.create({
    mongoUrl: uri,
    dbName: "career_connect_session",
    collectionName: "sessions",
});


app.use(session({
    secret: "A secret key to sign the cookie",
    resave: false,
    saveUninitialized: false,
    store: accountSessionStore,
}));


/* HOME */
const fetchTopSectors = async () => {
    try {
        const sectors = await jobModel.aggregate([
            { $group: { _id: "$sector" } },
            { $sample: { size: 8 } }
        ]);
        return sectors.map(s => s._id);
    } catch (error) {
        console.log(error);
        throw new Error('Error fetching sectors from the database');
    }
};

const fetchFeaturedJobs = async (limit = 4) => {
    try {
        const jobs = await jobModel.aggregate([
            { $match: { status: 'approved' } },
            { $sample: { size: limit } }
        ]);

        for (let job of jobs) {
            const employer = await employerModel.findById(job.employerId);
            if (employer) {
                job.employerName = employer.employerName;
            } else {
                job.employerName = "Unknown Employer";
            }
        }
        return jobs;
    } catch (error) {
        console.error('Error fetching featured jobs from the database:', error);
        throw new Error('Error fetching featured jobs from the database');
    }
};

app.get("/", async (req, res) => {
    try {
        const topSectors = await fetchTopSectors();
        const featuredJobs = await fetchFeaturedJobs();
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;
        res.render("home", { user, admin, employer, topSectors, featuredJobs });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/home", async (req, res) => {
    try {
        const topSectors = await fetchTopSectors();
        const featuredJobs = await fetchFeaturedJobs();
        const user = req.session.user;
        const employer = req.session.employer;
        const admin = req.session.admin;
        res.render("home", { user, admin, employer, topSectors, featuredJobs });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

/*User Search*/
app.get('/userSearch', (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("userSearch", { user, employer, admin });
})

/*Emp Search*/
app.get('/empSearch', (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("empSearch", { user, employer, admin });
})

/* contactUs */
app.get("/contactUs", (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render("contactUs", { user, employer, admin });
});
/*Abous us*/
app.get('/aboutUs', (req, res) => {
    const user = req.session.user;
    const employer = req.session.employer;
    const admin = req.session.admin;
    res.render('aboutUs', { user, employer, admin });
});

app.use("/", userRoutes);
app.use("/", empRoutes);
app.use("/", adminRoutes);
app.use("/", jobRoutes);