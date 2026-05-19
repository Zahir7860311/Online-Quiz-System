const mongoose = require("mongoose");
const User = require("./models/User");

mongoose.connect("mongodb://127.0.0.1:27017/quizDB")
.then(async () => {
    const result = await User.updateOne(
        { email: "admin@email.com" },
        { $set: { role: "admin" } }
    );
    console.log("✅ Admin role set successfully!");
    console.log("Matched:", result.matchedCount, "| Updated:", result.modifiedCount);
    process.exit();
})
.catch(err => console.log(err));
