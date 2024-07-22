const path = require("path");

module.exports = {
  entry: "./automatches.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
};
