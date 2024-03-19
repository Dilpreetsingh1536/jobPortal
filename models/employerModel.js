const mongoose = require("mongoose");

const uri =
    "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";


//userNewUrParser: true,
//useUnifiedTopology: true,

mongoose
    .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("=======Connected to MONGODB for Employer=======");
    })
    .catch((err) => {
        console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
    });

const employerSchema = new mongoose.Schema({
    employerName: {
        type: String,
        required: true,
        trim: true,
    },
    employerId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    sixDigitCode: {
        type: String,
        default: null
    },
    sixDigitCodeExpires: {
        type: Date,
        default: null
    },
    registrationNumber: {
        type: String,
        unique: true,
        trim: true,
        default: function () {
            return Math.random().toString(36).substr(2, 10);
        },
    },
    logo: {
        type: String,
        default: '/images/profile_logo.png', 
    },
});

const employerModel = mongoose.model("employerModel", employerSchema);

module.exports = employerModel;
