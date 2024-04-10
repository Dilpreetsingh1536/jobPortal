const mongoose = require("mongoose");

const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";


mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("=======Connected to MONGODB for User=======");
  })
  .catch((err) => {
    console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
  });

const experienceSchema = new mongoose.Schema({
  jobTitle: {
    type: String,
    required: true,
    trim: true,
  },
  company: {
    type: String,
    required: true,
    trim: true,
  },
  expStartDate: {
    type: Date,
    required: true,
  },
  expEndDate: {
    type: Date,
  },
  description: {
    type: String,
    trim: true,
  },
});

const educationSchema = new mongoose.Schema({
  educationTitle: {
    type: String,
    required: true,
    trim: true,
  },
  major: {
    type: String,
    required: true,
    trim: true,
  },
  institutionName: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
});

const messageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  read: {
    type: Boolean,
    required: true,
    default: false,
  }
});


const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
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
    default: null,
  },
  sixDigitCodeExpires: {
    type: Date,
    default: null,
  },
  logo: {
    type: String
  },
  education: [educationSchema],
  experience: [experienceSchema],
  messages: [messageSchema],
  likedJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'jobModel'
  }],
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'upload'
  }
});

userSchema.statics.findById = async function (userId) {
  return this.findOne({ _id: userId });
};

const userModel = mongoose.model("userModel", userSchema);

module.exports = userModel;
