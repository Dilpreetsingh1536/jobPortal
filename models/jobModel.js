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

  const jobModel = mongoose.model("jobModel", jobSchema);

  module.exports = jobModel;