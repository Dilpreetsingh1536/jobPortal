const mongoose = require('mongoose');

const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";


mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("=======Connected to MONGODB for contactMessage=======");
  })
  .catch((err) => {
    console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
  });

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
}, { timestamps: true });

const contactMessageModel = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = contactMessageModel;
