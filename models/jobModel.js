const mongoose = require("mongoose");


const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("=======Connected to MONGODB for Job Listing=======");
  })
  .catch((err) => {
    console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
  });

  const jobSchema = new mongoose.Schema({
    jobTitle: { type: String, required: true },
    sector: { type: String, required: true },
    salary: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    description: { type: String, required: true },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'employerModel', required: true }, 
    jobStatus : {type:Boolean  ,default:false}
});

const jobModel = mongoose.model("jobModel", jobSchema);

module.exports = jobModel;