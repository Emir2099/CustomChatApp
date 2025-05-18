---
sidebar_position: 1
---

# Installation & Setup

This guide will walk you through setting up the React Firebase Chat Application on your local development environment.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher) or **yarn** (v1.22.0 or higher)
- A code editor (we recommend Visual Studio Code)
- Git (optional, for version control)

## Step 1: Clone the Repository

First, clone the repository to your local machine:

```bash
git clone https://github.com/Emir2099/CustomChatApp.git
cd src
```

If you don't want to use Git, you can also download the source code as a ZIP file from the GitHub repository.

## Step 2: Install Dependencies

Install all the necessary dependencies using npm or yarn:

```bash
# Using npm
npm install

# Using yarn
yarn install
```

This will install all the required packages defined in the `package.json` file.

## Step 3: Configure Firebase

The application uses Firebase for authentication, database, and storage. You'll need to set up your own Firebase project:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** and follow the setup steps
3. Once your project is created, click on the web icon (<code>&lt;/&gt;</code>) to add a web app
4. Register your app with a nickname (e.g., "Chat App")
5. Copy the Firebase configuration object

Create a `.env` file in the root of your project with the following content:

```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

Replace the placeholder values with your Firebase project details.

## Step 4: Set Up Firebase Services

### Authentication

1. In the Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** authentication
3. Optionally, enable other authentication methods like Google or GitHub

### Database

1. Go to **Firestore Database** > **Create database**
2. Start in **test mode** for development purposes
3. Choose a database location closest to your target users

### Storage

1. Go to **Storage** > **Get started**
2. Accept the default security rules for now (we'll update them later)
3. Choose a storage location closest to your target users

## Step 5: Start the Development Server

Now you can start the development server:

```bash
# Using npm
npm start

# Using yarn
yarn start
```

This will launch the application on `http://localhost:3000`.

## Next Steps

Congratulations! You've successfully set up the React Firebase Chat Application. Next, you can:

- [Configure the application](configuration) with custom settings
- Learn about the [Firebase setup](firebase-setup) in more detail
- Explore the [architecture overview](../architecture/overview) to understand how everything fits together

## Troubleshooting

If you encounter any issues during setup:

- Make sure all environment variables are correctly set
- Check that you have the required Node.js version
- Verify that your Firebase project is correctly configured
- Look for errors in the browser console or terminal

If problems persist, please [open an issue](https://github.com/Emir2099/CustomChatApp/issues) on GitHub. 