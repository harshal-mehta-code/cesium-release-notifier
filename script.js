const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'CesiumGS';
const REPO_NAME = 'cesium-unreal';
const LAST_RELEASE_FILE = 'last_checked_release.txt';
// IMPORTANT: Path is now directly in the workspace root
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
    fs.writeFileSync(LAST_RELEASE_PATH, tag);
    console.log(`Updated ${LAST_RELEASE_FILE} with tag: ${tag} at path: ${LAST_RELEASE_PATH}`);
  } catch (error) {
    console.error(`Error writing to ${LAST_RELEASE_FILE} at path ${LAST_RELEASE_PATH}:`, error.message);
  }
}

async function sendEmail(release) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
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
    to: process.env.EMAIL_USERNAME,
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
    process.exit(1);
  }
}

async function run() {
  const latestRelease = await getLatestRelease();
  
  const lastCheckedTag = await readLastCheckedRelease();

  if (latestRelease && latestRelease.tag_name !== lastCheckedTag) {
    console.log(`New release found! Old tag: ${lastCheckedTag || 'None'}, New tag: ${latestRelease.tag_name}`);
    await sendEmail(latestRelease);
    await writeLastCheckedRelease(latestRelease.tag_name);
  } else {
    console.log('No new release found or tag is the same as last checked.');
    console.log(`Debug: Current latest tag: ${latestRelease ? latestRelease.tag_name : 'N/A'}, Last checked tag: ${lastCheckedTag || 'None'}`);
  }
}

run();
