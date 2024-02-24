const mongoose = require("mongoose");

const uri =
    "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority";

mongoose
    .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("=======Connected to MONGODB for Admin=======");
    })
    .catch((err) => {
        console.log(`Not Connected To MONGODB Due To Error Below \n ${err}`);
    });


const adminSchema = new mongoose.Schema({
    adminId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
});

const adminModel = mongoose.model("adminModel", adminSchema);

module.exports = adminModel;