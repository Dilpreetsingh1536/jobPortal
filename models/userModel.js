const mongoose = require("mongoose");

const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";

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
});

userSchema.statics.findById = async function (userId) {
  return this.findOne({ _id: userId });
};

const userModel = mongoose.model("userModel", userSchema);

module.exports = userModel;
