const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

const renderSecretPath = "/etc/secrets/serviceAccountKey.json";

if (fs.existsSync(renderSecretPath)) {
  serviceAccountPath = renderSecretPath;
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = db;