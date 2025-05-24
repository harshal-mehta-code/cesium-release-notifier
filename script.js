const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'CesiumGS';
const REPO_NAME = 'cesium-unreal';
const LAST_RELEASE_FILE = 'last_checked_release.txt';
// IMPORTANT FIX: Path is now directly in the workspace root for simplicity and reliability
const LAST_RELEASE_PATH = path.join(process.env.GITHUB_WORKSPACE, LAST_RELEASE_FILE);

async function getLatestRelease() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers: {
        'Authorization': `token ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching latest release:', error.message);
    process.exit(1);
  }
}

async function readLastCheckedRelease() {
  try {
    // IMPORTANT: When downloaded, artifacts are usually in a subdirectory named after the artifact.
    // So, we need to check inside that subdirectory if dawidd6/action-download-artifact puts it there.
    // However, for this round, we are simplifying by having script.js write to the root
    // and relying on dawidd6/action-download-artifact's 'path: .' to unzip to the root.
    // If you are using actions/download-artifact in future where it unzips into a folder,
    // you will need to read from path.join(process.env.GITHUB_WORKSPACE, 'ARTIFACT_NAME', LAST_RELEASE_FILE);
    if (fs.existsSync(LAST_RELEASE_PATH)) {
      const tag = fs.readFileSync(LAST_RELEASE_PATH, 'utf8').trim();
      console.log(`Successfully read last checked tag from ${LAST_RELEASE_FILE} at ${LAST_RELEASE_PATH}: ${tag}`);
      return tag;
    }
  } catch (error) {
    console.warn(`Could not read ${LAST_RELEASE_FILE} at ${LAST_RELEASE_PATH}:`, error.message);
  }
  return null;
}

async function writeLastCheckedRelease(tag) {
  try {
    // No need to mkdirSync as it's directly in the root and will be created or overwritten
    fs.writeFileSync(LAST_RELEASE_PATH, tag);
    console.log(`Updated ${LAST_RELEASE_FILE} with tag: ${tag} at path: ${LAST_RELEASE_PATH}`);
  } catch (error) {
    console.error(`Error writing to ${LAST_RELEASE_FILE} at path ${LAST_RELEASE_PATH}:`, error.message);
  }
}

async function sendEmail(release) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // IMPORTANT: Modify this if you are not using Gmail
    port: 587,              // IMPORTANT: Typically 587 for TLS/STARTTLS, 465 for SSL
    secure: false,          // IMPORTANT: Use 'true' for 465, 'false' for 587
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: process.env.EMAIL_USERNAME, // Sends the notification to yourself
    subject: `🚨 New Cesium Unreal Release: ${release.tag_name} 🚨`,
    html: `
      <p>A new release of Cesium Unreal has been detected!</p>
      <p><b>Release Name:</b> ${release.name || release.tag_name}</p>
      <p><b>Tag:</b> ${release.tag_name}</p>
      <p><b>Published At:</b> ${new Date(release.published_at).toLocaleString()}</p>
      <p><b>Release URL:</b> <a href="${release.html_url}">${release.html_url}</a></p>
      <br>
      <p>You can find more details and download the release here:</p>
      <a href="${release.html_url}">${release.html_url}</a>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email notification sent successfully!');
  } catch (error) {
    console.error('Error sending email:', error.message);
    if (error.responseCode === 535) {
        console.error('Authentication failed. Please check your EMAIL_USERNAME and EMAIL_PASSWORD secrets.');
        console.error('If using Gmail, ensure you are using an App Password and that 2FA is enabled.');
    }
    process.exit(1); // Exit with an error code if email fails
  }
}

async function run() {
  const latestRelease = await getLatestRelease();
  
  // Read last checked tag from the downloaded artifact
  const lastCheckedTag = await readLastCheckedRelease();

  if (latestRelease && latestRelease.tag_name !== lastCheckedTag) {
    console.log(`New release found! Old tag: ${lastCheckedTag || 'None'}, New tag: ${latestRelease.tag_name}`);
    await sendEmail(latestRelease);
    await writeLastCheckedRelease(latestRelease.tag_name);
  } else {
    console.log('No new release found or tag is the same as last checked.');
    // Add logging to explicitly show the tags being compared for debugging
    console.log(`Debug: Current latest tag: ${latestRelease ? latestRelease.tag_name : 'N/A'}, Last checked tag: ${lastCheckedTag || 'None'}`);
  }
}

run();
