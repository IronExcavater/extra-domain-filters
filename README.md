# 🏡 [Extra Domain Filters](https://chromewebstore.google.com/detail/extra-domain-filters/opblibcobnkicpdjkinngfcbjjnjldkg)

## 🚀 Overview
This browser extension supercharges domain.com.au by adding advanced filtering options, making it easier to find your dream property! 🎯

## ✨ Features
- ✅ **Preference Matches** – Labels listings that contain your optional “Could-Have” features.
- ❌ **Exclude Keywords** – Automatically hides listings containing unwanted keywords in their descriptions.
- 🏢 **Studio Property Fix** – Ensures studios are correctly identified based on descriptions, not just tags.
- 💰 **Strata Fee Filter** – Adds a slider to exclude properties with excessively high strata fees.
- 🗺 **Map Integration** – Highlights preferred listings directly on the map for easy identification.
- 🔄 **Persistent Filters** – Saves your filters and preferences across browsing sessions.
- ⚡ **Real-Time Updates** – Instantly applies changes as filters are adjusted.
- 🚫 **Blacklist Listings** – Allows you to hide specific listings you don't want to see.
- 🗑 **Manage Blacklist** – Adds a dedicated page to review and restore blacklisted listings.
- 🔔 **Saved Search Alerts** – Creates and edits real Domain email alerts with Daily, Weekly, and Never options.
- 🔐 **Unified Account Login** – Supports email/password and Google, with optional Apple and Facebook providers.

## 🛠 Installation
### 🔹 Chrome Web Store (Recommended)
1. Visit the extension page: **[Extra Domain Filters](https://chromewebstore.google.com/detail/extra-domain-filters/opblibcobnkicpdjkinngfcbjjnjldkg)**
2. Click **Add to Chrome** and confirm the installation.

### 🔹 Manual Installation (Developer)
1. **Download or clone** this repository.
2. Run `npm install`.
3. Run `npm run dev`.
4. In Chrome's extension developer mode, choose **Load unpacked** and select the generated `dist` directory.
5. Keep Vite running while developing. CRXJS handles content-script HMR/live reload from the dev server.

### 🔹 Release Build
1. Run `npm run build`.
2. The build output is `dist`.
3. The packaged zip is written to `release`.

### 🔐 Authentication providers

Email/password, Google, Apple, and Facebook use the same Firebase account. Apple and Facebook use the included hosted federated-authentication bridge plus provider-console setup. Follow [the authentication setup guide](docs/authentication.md) for the exact Firebase, Meta, Apple, local-development, deployment, and verification steps. Provider secrets stay in Firebase/Apple/Meta and must never be added to `.env`.

## 🎯 Usage
1. Search for properties on **[Domain.com.au](https://www.domain.com.au)**.
2. Use the new filtering options in the menus to refine your search.
3. Listings that include optional preferences receive concise match labels.
4. Blacklisted or filtered listings collapse into recoverable rows, so you can unblacklist them or choose **Show anyway** without changing all filters.
5. Manage your **blacklist** through the user profile menu (top-right corner).

## 🤝 Contribute
Want to make this extension even better? 🚀 Feel free to **submit issues** or **open a pull request** with your improvements!

## 📜 License
This project is licensed under the **MIT License**. 📄

