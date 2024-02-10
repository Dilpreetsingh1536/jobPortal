const mongoose = require("mongoose");

const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/user_Model?retryWrites=true&w=majority";

//userNewUrParser: true,
//useUnifiedTopology: true,

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("=======Connected to MONGODB=======");
  })
  .catch((err) => {
    console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
  });

const jobSchema = new mongoose.Schema({
    company: {
        type: String,
        required: [true,'Company name is required']
    },
    position: {
        type: string,
        required: [true,'Job position is required'],
        minlength: 200
    },
    status: {
        type: string,
        enum: ['in process', 'rejected', 'pending', 'interview'],
        default: 'pending'
    },
    workType: {
        type: string,
        enum: ['part-time', 'full-time', 'contract','internship'],
        default: 'full-time'
    },
    workLocation: {
        type: string,
        enum: ['waterloo','toronto','new-york','london','mumbai'],
        default: 'toronto',
        required: [true, 'Job location is required']
    },
    author: {
        type: mongoose.Types.ObjectId,
        ref: 'userModel'
    }  
});

const jobModel = mongoose.model("jobModel", jobSchema);

module.exports = jobModel;
