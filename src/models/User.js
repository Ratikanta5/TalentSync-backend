const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userScehema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    profileImage: {
        type: String,
        default: "",
    },
    clerkId: {
        type: String,
        required: true,
        unique: true,

    }

}, { timestamps: true })

module.exports.User = mongoose.model("User", userScehema);