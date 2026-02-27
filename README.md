# ✝️ PCM Fellowship Scheduler Bot

A feature-rich **Telegram bot** for easy fellowship ministry scheduling, member management, and reminders — built with a modern tech stack and a focus on simplicity for users and admins alike.

---

<p align="center">
  <img src="https://img.shields.io/github/languages/top/Henok-SE/PCMScheduler?style=for-the-badge"/>
  <img src="https://img.shields.io/github/license/Henok-SE/PCMScheduler?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Platform-Telegram-blue?style=for-the-badge"/>
</p>

---

## 🚀 Features

- **🙋 Member Registration & Management**
  - Self-registration with multiple talents (roles)
  - Edit member info, add phone number, activate/deactivate, and delete (admin only)
  - View detailed member info

- **📅 Program Schedule Generation**
  - Automatic 4-week rolling schedule assignment based on roles/talents
  - Handy displays: “My Schedule,” “This Week,” and “Monthly” overviews

- **🔔 Scheduling Reminders**
  - Weekly reminders sent every Wednesday 8AM (Africa/Addis_Ababa timezone)
  - Force reminder broadcast (admin only)

- **🛡 Admin Control Panel**
  - Easily manage members and schedules via Telegram
  - Regenerate schedule, send announcements, export data, and advanced stats
  - Export/backup and database clearing tools

- **💾 Database**
  - Persistent, auto-managed SQLite database in `/data/fellowship.db`

- **🌐 Render.com & Cloud-Ready**
  - Lightweight HTTP server for cloud provider compatibility (e.g., Render.com)
  - Configuration YAML for auto-deploy

---

## 🛠️ Tech Stack

<p>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white&style=for-the-badge"/>
  <img alt="Telegraf" src="https://img.shields.io/badge/Telegraf-4EA94B?logo=telegram&logoColor=white&style=for-the-badge"/>
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white&style=for-the-badge"/>
  <img alt="Render" src="https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=black&style=for-the-badge"/>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black&style=for-the-badge"/>
</p>

- **Node.js** — Lightning-fast JavaScript runtime for scalable bots
- **Telegraf** — Robust Telegram bot API framework
- **Better-SQLite3** — High-performance SQLite storage
- **node-cron** — Flexible and reliable job scheduling

---

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Henok-SE/PCMScheduler.git
cd PCMScheduler

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env   # Or create .env manually
# Fill in:
# BOT_TOKEN=<Your Telegram Bot Token>
# ADMIN_ID=<Your Telegram numeric ID>
# PORT=3000            # Optional (for Render.com or your host)
```
- Get your BOT_TOKEN from [@BotFather](https://t.me/BotFather)
- Get your Telegram numeric ID (for admin) from [@userinfobot](https://t.me/userinfobot)

```bash
# 4. Start the bot:
node index.js
# (Or deploy to Render.com for 24/7 operation)
```

---

## 🌍 Deployment

- **Render.com**: Handles HTTP landing for health checks out-of-the-box. [render.yaml](./render.yaml) is included.
- Use a **Persistent Disk** pointed at `/data` to keep your SQLite database safe.
- Environment variables are managed in the Render.com dashboard.

---

## 🗂️ Project Structure

```
├── index.js           # Main bot logic
├── package.json       # NPM scripts and dependencies
├── render.yaml        # Deployment config for Render.com
├── data/
│   └── fellowship.db  # SQLite database (auto-created)
├── .gitignore
└── README.md
```

---

## 📝 Key Bot Commands & Menu

- **/start** – Welcome and register
- **Main Menu** — Register, This Week, My Schedule, Monthly Schedule, Help (Admin panel button for admins)
- **Admin Panel** — Manage members, regenerate schedules, send reminders/announcements, view stats, export, and settings

---

## 🛡️ Security & Backup

- All sensitive data stored in `/data/fellowship.db` (never tracked in git)
- Admin: Export all data as JSON and manage the db from your Telegram panel
- Reset/Clear options are protected — only for ADMIN_ID

---

## 🤝 Contributing

Pull requests and issues welcome! Suggest or add new features, localizations, or improvements.

---

## 🙏 About

Created by [Henok-SE](https://github.com/Henok-SE) for community and church fellowship management.

> *To God be all the glory!*

---

<p align="center"><b>Made with ❤️ & faith to help your fellowship flourish!</b></p>
