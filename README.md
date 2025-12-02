# Cesium Release Notifier 🚀

A lightweight, automated tool that monitors **[Cesium for Unreal](https://github.com/CesiumGS/cesium-unreal)** and **[CesiumJS](https://github.com/CesiumGS/cesium)** repositories for new releases. When a new release is detected, it sends an email notification instantly.

## ✨ Features

*   **Multi-Repo Support**: Monitors both `cesium-unreal` and `cesium` repositories.
*   **Automated Checks**: Runs daily via GitHub Actions (default: 14:00 UTC).
*   **State Tracking**: Remembers the last checked release tag to avoid duplicate notifications using GitHub Artifacts.
*   **Email Notifications**: Sends a formatted email with release details and download links via Gmail.

## 🛠️ Setup

### Prerequisites

1.  **GitHub Repository**: Fork or clone this repository.
2.  **Gmail Account**: You need a Gmail account to send notifications.
    *   *Note*: For security, it is highly recommended to use an **App Password** if you have 2FA enabled.

### Secrets Configuration

Go to your repository's **Settings** > **Secrets and variables** > **Actions** and add the following repository secrets:

| Secret Name | Description |
| :--- | :--- |
| `GH_TOKEN` | A GitHub Personal Access Token (PAT) with `repo` scope to query the API. |
| `EMAIL_USERNAME` | Your Gmail address (e.g., `user@gmail.com`). |
| `EMAIL_PASSWORD` | Your Gmail App Password (not your login password). |

## 🚀 Usage

### Automated Run
The workflow is scheduled to run automatically every day at **14:00 UTC**.

### Manual Trigger
You can trigger the check manually at any time:
1.  Go to the **Actions** tab.
2.  Select **Cesium Unreal Release Notifier**.
3.  Click **Run workflow**.

## 📦 How It Works

1.  **Fetch**: The script queries the GitHub API for the latest release tag of the monitored repositories.
2.  **Compare**: It compares the latest tag with the state stored in `release_state.json` (downloaded from the previous run's artifacts).
3.  **Notify**: If a new tag is found, it sends an email using `nodemailer`.
4.  **Persist**: The new tag is saved to `release_state.json` and uploaded as an artifact for the next run.

## 💻 Local Development

To run the script locally:

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set environment variables (create a `.env` file or export them):
    ```bash
    export GH_TOKEN="your_token"
    export EMAIL_USERNAME="your_email"
    export EMAIL_PASSWORD="your_password"
    ```
4.  Run the script:
    ```bash
    node script.js
    ```
