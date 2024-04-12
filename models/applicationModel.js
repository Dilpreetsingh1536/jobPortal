const mongoose = require("mongoose");

const uri =
    "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";

mongoose
    .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("=======Connected to MONGODB for Job application=======");
    })
    .catch((err) => {
        console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
    });
const applicationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: './jobModel.js',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: './userModel.js',
        required: true
    },
    resume: {
        type: String,
        required: true
    },
    coverLetter: {
        type: String,
        required: true
    },
    decision: { type: String, default: 'In Process' },

});

const applicationModel = mongoose.model('applicationModel', applicationSchema);
module.exports = applicationModel;