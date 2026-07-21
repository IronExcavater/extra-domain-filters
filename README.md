# 🏡 [Extra Domain Filters](https://chromewebstore.google.com/detail/extra-domain-filters/opblibcobnkicpdjkinngfcbjjnjldkg)

## 🚀 Overview
This browser extension supercharges domain.com.au by adding advanced filtering options, making it easier to find your dream property! 🎯

## ✨ Features
- 🟡 **Preference Highlighting** – Highlights properties that match your preferences with a yellow tint, intensifying with stronger matches.
- ❌ **Exclude Keywords** – Automatically hides listings containing unwanted keywords in their descriptions.
- 🏢 **Studio Property Fix** – Ensures studios are correctly identified based on descriptions, not just tags.
- 💰 **Strata Fee Filter** – Adds a slider to exclude properties with excessively high strata fees.
- 🗺 **Map Integration** – Highlights preferred listings directly on the map for easy identification.
- 🔄 **Persistent Filters** – Saves your filters and preferences across browsing sessions.
- ⚡ **Real-Time Updates** – Instantly applies changes as filters are adjusted.
- 🚫 **Blacklist Listings** – Allows you to hide specific listings you don't want to see.
- 🗑 **Manage Blacklist** – Adds a dedicated page to remove blacklisted listings.

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

## 🎯 Usage
1. Search for properties on **[Domain.com.au](https://www.domain.com.au)**.
2. Use the new filtering options in the menus to refine your search.
3. Listings that include **preferences are highlighted** in tint between **green** (20% match) to **gold** (90% match).
4. Listings that are **blacklisted or include excluded keywords are hidden** automatically from the page.
4. Manage your **blacklist** through the user profile menu (top-right corner)

## 🤝 Contribute
Want to make this extension even better? 🚀 Feel free to **submit issues** or **open a pull request** with your improvements!

## 📜 License
This project is licensed under the **MIT License**. 📄

