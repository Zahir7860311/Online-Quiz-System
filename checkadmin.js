const mongoose = require("mongoose");
const User = require("./models/User");

mongoose.connect("mongodb://127.0.0.1:27017/quizDB")
.then(async () => {
    const users = await User.find();
    console.log("All users and their roles:");
    users.forEach(u => {
        console.log(`Username: ${u.username} | Email: ${u.email} | Role: ${u.role}`);
    });
    process.exit();
})
.catch(err => console.log(err));
