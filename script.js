const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const REPOS = [
  { owner: 'CesiumGS', name: 'cesium-unreal', displayName: 'Cesium Unreal' },
  { owner: 'CesiumGS', name: 'cesium', displayName: 'CesiumJS' }
];

const STATE_FILE = 'release_state.json';
// IMPORTANT: Path is now directly in the workspace root
const STATE_FILE_PATH = path.join(process.env.GITHUB_WORKSPACE || __dirname, STATE_FILE);

async function getLatestRelease(owner, name) {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${name}/releases/latest`, {
      headers: {
        'Authorization': `token ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching latest release for ${owner}/${name}:`, error.message);
    return null;
  }
}

async function readState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      console.log(`Successfully read state from ${STATE_FILE} at ${STATE_FILE_PATH}`);
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Could not read or parse ${STATE_FILE} at ${STATE_FILE_PATH}:`, error.message);
  }
  return {};
}

async function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
    console.log(`Updated ${STATE_FILE} at path: ${STATE_FILE_PATH}`);
  } catch (error) {
    console.error(`Error writing to ${STATE_FILE} at path ${STATE_FILE_PATH}:`, error.message);
  }
}

async function sendEmail(release, repoDisplayName) {
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
    subject: `🚨 New ${repoDisplayName} Release: ${release.tag_name} 🚨`,
    html: `
      <p>A new release of <b>${repoDisplayName}</b> has been detected!</p>
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
    console.log(`Email notification sent successfully for ${repoDisplayName}!`);
  } catch (error) {
    console.error(`Error sending email for ${repoDisplayName}:`, error.message);
    if (error.responseCode === 535) {
        console.error('Authentication failed. Please check your EMAIL_USERNAME and EMAIL_PASSWORD secrets.');
        console.error('If using Gmail, ensure you are using an App Password and that 2FA is enabled.');
    }
    // Don't exit process here, so we can try other repos
  }
}

async function run() {
  const state = await readState();
  let stateUpdated = false;

  for (const repo of REPOS) {
    console.log(`Checking ${repo.displayName}...`);
    const latestRelease = await getLatestRelease(repo.owner, repo.name);
    
    if (!latestRelease) continue;

    const lastCheckedTag = state[repo.name];

    if (latestRelease.tag_name !== lastCheckedTag) {
      console.log(`New release found for ${repo.displayName}! Old tag: ${lastCheckedTag || 'None'}, New tag: ${latestRelease.tag_name}`);
      await sendEmail(latestRelease, repo.displayName);
      state[repo.name] = latestRelease.tag_name;
      stateUpdated = true;
    } else {
      console.log(`No new release found for ${repo.displayName}.`);
      console.log(`Debug: Current latest tag: ${latestRelease.tag_name}, Last checked tag: ${lastCheckedTag || 'None'}`);
    }
  }

  if (stateUpdated) {
    await writeState(state);
  }
}

run();
