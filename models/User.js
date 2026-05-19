const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: {
        type: String,
        default: "user"   // everyone is "user" by default, only admin is "admin"
    }
});

module.exports = mongoose.model("User", userSchema);
