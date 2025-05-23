const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'CesiumGS';
const REPO_NAME = 'cesium-unreal';
const LAST_RELEASE_FILE = 'last_checked_release.txt';
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
    if (fs.existsSync(LAST_RELEASE_PATH)) {
      return fs.readFileSync(LAST_RELEASE_PATH, 'utf8').trim();
    }
  } catch (error) {
    console.warn(`Could not read ${LAST_RELEASE_FILE}:`, error.message);
  }
  return null;
}

async function writeLastCheckedRelease(tag) {
  try {
    fs.writeFileSync(LAST_RELEASE_PATH, tag);
    console.log(`Updated ${LAST_RELEASE_FILE} with tag: ${tag}`);
  } catch (error) {
    console.error(`Error writing to ${LAST_RELEASE_FILE}:`, error.message);
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
  }
}

run();
