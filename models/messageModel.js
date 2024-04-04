const mongoose = require('mongoose');



const uri =
  "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";


mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("=======Connected to MONGODB for Message=======");
  })
  .catch((err) => {
    console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
  });

  const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'senderModel' 
    },
    senderModel: {
        type: String,
        required: true,
        enum: ['userModel', 'employerModel'] 
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientModel' 
    },
    recipientModel: {
        type: String,
        required: true,
        enum: ['userModel', 'employerModel'] 
    },
    message: {
        type: String,
        required: true
    },
    reply: {
        type: String 
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model('messageModel', messageSchema);

module.exports = Message;