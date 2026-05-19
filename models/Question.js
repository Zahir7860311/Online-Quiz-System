const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({

topic:String,
question:String,
options:[String],
answer:String

});

module.exports = mongoose.model("Question",questionSchema);