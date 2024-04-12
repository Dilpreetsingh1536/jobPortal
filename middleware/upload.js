const mongoose = require('mongoose');
const GridFsStorage = require('multer-gridfs-storage');
const multer = require('multer');
const Grid = require('gridfs-stream');
const crypto = require('crypto');
const path = require('path');

let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
});

const storage = new GridFsStorage({
    url:   "mongodb+srv://dilpreet1999:Singh1536@cluster0.4g4xjah.mongodb.net/careerconnect_model?retryWrites=true&w=majority",


    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'upload' 
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({ storage });

module.exports = upload;