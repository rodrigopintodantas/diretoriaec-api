const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");

const indexRouter = require("./routes/index");
const errorHandler = require("./middlewares/error-handler");

const app = express();
const publicDir = path.join(__dirname, "public");
const spaIndexPath = path.join(publicDir, "index.html");

app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,POST,DELETE,PATCH",
    allowedHeaders: ["Content-Type", "Authorization", "up"],
    exposedHeaders: ["Authorization"],
  }),
);
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(publicDir));

app.use("/api", indexRouter);

app.get(/^\/(?!api).*/, (req, res, next) => {
  if (path.extname(req.path)) return next();
  if (!fs.existsSync(spaIndexPath)) return next();
  return res.sendFile(spaIndexPath);
});

app.use(errorHandler);

module.exports = app;
