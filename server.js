const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Score = require("./models/Score");
const Question = require("./models/Question");

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

// ================= SESSION =================

app.use(session({
    secret: "quizsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ================= DATABASE =================

mongoose.connect("mongodb://127.0.0.1:27017/quizDB")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));


// ================= LOGIN CHECK =================

async function checkLogin(req, res, next) {
    if (req.session.user) {
        try {
            const userExists = await User.findById(req.session.user._id);
            if (userExists) {
                return next();
            } else {
                req.session.destroy();
                return res.redirect("/login");
            }
        } catch (err) {
            req.session.destroy();
            return res.redirect("/login");
        }
    } else {
        return res.redirect("/login");
    }
}

// ================= ADMIN CHECK =================

function checkAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === "admin") {
        return next();
    }
    return res.status(403).send("Access Denied. Admins only.");
}


// ================= HOME =================

app.get("/", checkLogin, (req, res) => {
    res.render("index", { user: req.session.user });
});


// ================= REGISTER =================

app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("register");
});

app.post("/register", async (req, res) => {

    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
        return res.send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = new User({
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword
    });

    await user.save();
    res.redirect("/login");
});


// ================= LOGIN =================

app.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/");
    res.render("login");
});

app.post("/login", async (req, res) => {

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return res.send("User not found");
    }

    const valid = await bcrypt.compare(req.body.password, user.password);

    if (valid) {
        req.session.user = user;
        res.redirect("/");
    } else {
        res.send("Wrong password");
    }
});


// ================= LOGOUT =================

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});


// ================= QUIZ INFO =================

app.get("/quiz-info/:topic", checkLogin, (req, res) => {
    const topic = req.params.topic.toLowerCase();
    res.render("quiz-info", { topic, total: 20 });
});


// ================= QUIZ =================

app.get("/quiz/:topic", checkLogin, async (req, res) => {

    const topic = req.params.topic.toLowerCase();

    // Fetch questions from DB
    const questions = await Question.find({ topic: topic });

    if (questions.length === 0) {
        return res.send("No questions found for this topic. Please ask admin to add questions.");
    }

    // Add name field (q1, q2...) for form handling
    const formattedQuestions = questions.map((q, i) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        name: "q" + (i + 1)
    }));

    res.render("quiz", { topic, questions: formattedQuestions });
});


// ================= RESULT =================

app.post("/result", checkLogin, async (req, res) => {

    const topic = req.body.topic.toLowerCase();
    const userAnswers = req.body;

    const questions = await Question.find({ topic: topic });

    const formattedQuestions = questions.map((q, i) => ({
        question: q.question,
        answer: q.answer,
        name: "q" + (i + 1)
    }));

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let results = [];

    formattedQuestions.forEach(q => {

        const userAnswer = userAnswers[q.name];
        const correctAnswer = q.answer;
        let isCorrect = false;

        if (userAnswer === correctAnswer) {
            score += 5;
            correctCount++;
            isCorrect = true;
        } else {
            if (userAnswer) wrongCount++;
        }

        results.push({
            question: q.question,
            userAnswer: userAnswer || "Not Attempted",
            correctAnswer,
            isCorrect
        });
    });

    await Score.create({
        username: req.session.user.username,
        topic: topic,
        score: score
    });

    res.render("result", {
        score,
        total: formattedQuestions.length * 5,
        correctCount,
        wrongCount,
        results
    });
});


// ================= LEADERBOARD =================

app.get("/leaderboard", checkLogin, async (req, res) => {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.render("leaderboard", { scores });
});


// ================= ADMIN =================

app.get("/admin", checkLogin, checkAdmin, async (req, res) => {
    const users = await User.find();
    const scores = await Score.find().sort({ score: -1 });
    const questions = await Question.find();
    res.render("admin", { users, scores, questions });
});

// ADD QUESTION
app.post("/admin/add-question", checkLogin, checkAdmin, async (req, res) => {
    const { topic, question, option1, option2, option3, answer } = req.body;
    await Question.create({
        topic: topic.toLowerCase(),
        question,
        options: [option1, option2, option3],
        answer
    });
    res.redirect("/admin");
});

// DELETE QUESTION
app.post("/admin/delete-question/:id", checkLogin, checkAdmin, async (req, res) => {
    await Question.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
});

// EDIT QUESTION - show form
app.get("/admin/edit-question/:id", checkLogin, checkAdmin, async (req, res) => {
    const question = await Question.findById(req.params.id);
    res.render("edit-question", { question });
});

// EDIT QUESTION - save
app.post("/admin/edit-question/:id", checkLogin, checkAdmin, async (req, res) => {
    const { topic, question, option1, option2, option3, answer } = req.body;
    await Question.findByIdAndUpdate(req.params.id, {
        topic: topic.toLowerCase(),
        question,
        options: [option1, option2, option3],
        answer
    });
    res.redirect("/admin");
});


// ================= SERVER =================

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
