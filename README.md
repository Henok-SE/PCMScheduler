# PCM Fellowship Scheduler Bot

A powerful Telegram bot for managing your fellowship’s members and weekly program schedules, featuring registration, attendance tracking, automated reminders, and full admin controls.

---

## ✨ Features

- **Member Registration & Management**
  - Self-registration with talent/role selection (multiple allowed)
  - Phone number collection, active/inactive toggle, and live member editing (admin only)
  - Member deletion and detailed member view (admin only)
- **Schedule Generation**
  - Automatic and regenerable 4-week service schedule with smart role assignment
  - Personalized views: this week's schedule, monthly program, and individual roles
- **Automated Reminders**
  - Weekly reminders sent every Wednesday at 8 AM (Africa/Addis_Ababa timezone)
  - “Force Reminder” for immediate broadcast (admin only)
- **Admin Control Panel**
  - Add/edit/delete members, regenerate schedule, broadcast announcements, and view statistics
  - Export all data to JSON, clear schedules or entire database, and view detailed stats
- **Database**
  - Uses a persistent, auto-managed SQLite database (data/fellowship.db)
  - Data is auto-created and upgraded on startup (no manual migration needed)
- **Render.com Optimized**
  - Simple HTTP server included for Render.com healthchecks

---

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Henok-SE/PCMScheduler.git
   cd PCMScheduler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   - Copy `.env.example` to `.env` (You must create this file yourself!):
     ```
     BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
     ADMIN_ID=YOUR_TELEGRAM_NUMERIC_ID
     PORT=3000              # For Render.com or default local (optional)
     ```
   - Obtain your Telegram Bot token from [@BotFather](https://t.me/BotFather).
   - Your Telegram numeric ID for ADMIN access (find with @userinfobot).

4. **Run the bot locally**
   ```bash
   node index.js
   ```
   The bot will now be online and running! For production, deploy using [Render.com](https://render.com/) or another Node.js-friendly host.

---

## ⚙️ Deployment (Render.com Example)

- The bot includes a basic HTTP landing page to comply with Render’s “Web Service” model.
- Make sure your [`render.yaml`](render.yaml) is valid for easiest deployment.
- The SQLite database is written to `data/fellowship.db` by default. Add a “Persistent Disk” pointing to `/data` for database durability.

---

## 📂 Repository Structure

```
├── index.js           # Main bot source code (all bot logic here)
├── package.json       # Node.js dependencies and scripts
├── render.yaml        # (Optional) Render.com deployment config
├── data/
│   └── fellowship.db  # SQLite database (auto-created)
├── .gitignore
└── README.md
```

---

## 🛠 Technologies Used

- **Node.js** – main runtime
- **Telegraf** – Telegram Bot framework ([npm](https://www.npmjs.com/package/telegraf))
- **Better-SQLite3** – fast, persistent local database
- **node-cron** – scheduled background reminders

---

## 📝 Usage Overview

- **/start** – Kick off registration (select name/roles)
- **Main Menu Buttons:** Register, This Week, Monthly Schedule, My Schedule, Help (and “Admin” for privileged users)
- **Admin Panel:** View/manage members, regenerate schedule, Force/Automated reminders, announcements, statistics, export, and settings

---

## 🛡 Security/Backup

- **Database:** All user and schedule data stored in `data/fellowship.db`
- **Export:** Admin can export all data to JSON from the control panel
- **Database management:** Admin can clear/restore the database from in-bot commands

---

## 🤝 Contributions

Contributions welcome! Please open issues or submit pull requests for new features, improvements, or bug fixes.

---

## 🙏 Credit

Built by [Henok-SE](https://github.com/Henok-SE) for PCM Fellowship management.

*To God be the glory!*
