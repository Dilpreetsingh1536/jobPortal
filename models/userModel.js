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

  const modelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    sixDigitCode: {
        type: String,
        default: null
    },
    sixDigitCodeExpires: {
        type: Date,
        default: null
    }
});


const userModel = mongoose.model("userModel", modelSchema);

module.exports = userModel;
